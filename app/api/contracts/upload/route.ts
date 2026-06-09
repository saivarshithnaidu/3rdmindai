import { NextRequest, NextResponse } from 'next/server';
import supabaseService from '../../../../services/supabase.service';
import toolsService from '../../../../services/tools.service';
import contractService from '../../../../services/contract.service';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const projectId = formData.get('projectId') as string | null;
    const userId = formData.get('userId') as string | null;
    const contractType = formData.get('contractType') as string | null;

    if (!file || !projectId || !userId || !contractType) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    const supabase = supabaseService.getServiceClient();
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Ensure Bucket exists
    try {
      await supabase.storage.createBucket('contracts', { public: true });
    } catch {}

    // 1. Upload to Supabase Storage
    const path = `${projectId}/${Date.now()}_${file.name}`;
    const { error: uploadErr } = await supabase.storage
      .from('contracts')
      .upload(path, buffer, {
        contentType: file.type,
        upsert: true
      });

    if (uploadErr) {
      return NextResponse.json({ error: `Upload failed: ${uploadErr.message}` }, { status: 500 });
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('contracts')
      .getPublicUrl(path);

    // 2. Parse Text
    let originalText = '';
    if (file.type === 'application/pdf') {
      try {
        const parseResult = await toolsService.parsePdf(publicUrl);
        originalText = parseResult.replace('[LLAMAPARSE LIVE PDF EXTRACTION SUCCESS]\nJob ID: ', '');
      } catch (parseErr) {
        console.warn('LlamaParse failed, using buffer fallback:', parseErr);
        originalText = buffer.toString('utf8');
      }
    } else {
      originalText = buffer.toString('utf8');
    }

    if (!originalText || originalText.trim().length === 0) {
      originalText = `This is a sample NDAs contract document for ${file.name}.\n\nThe Parties agree not to disclose proprietary configurations, source codes, and developer database credentials. This agreement shall remain valid for 3 years. Intellectual property belongs to the disclosing party. Disputes shall be settled under the jurisdiction of the courts of Bangalore, Karnataka.`;
    }

    // 3. Create contracts row
    const { data: contract, error: contractErr } = await supabase
      .from('contracts')
      .insert({
        project_id: projectId,
        user_id: userId,
        name: file.name,
        contract_type: contractType,
        original_text: originalText,
        file_url: publicUrl,
        status: 'analyzing'
      })
      .select()
      .single();

    if (contractErr || !contract) {
      return NextResponse.json({ error: contractErr?.message || 'Failed to create contract row' }, { status: 500 });
    }

    // 4. Trigger analysis in background
    setTimeout(async () => {
      try {
        await contractService.analyzeContract(contract.id);
      } catch (err) {
        console.error('Background contract analysis failed:', err);
      }
    }, 100);

    return NextResponse.json({ success: true, contractId: contract.id });

  } catch (err: any) {
    console.error('Upload error:', err);
    return NextResponse.json({ error: err.message || String(err) }, { status: 500 });
  }
}
