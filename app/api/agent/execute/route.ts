import { NextRequest, NextResponse } from 'next/server';
import { Receiver } from '@upstash/qstash';
import supabaseService from '../../../../services/supabase.service';
import agentRuntimeService from '../../../../services/agent-runtime.service';

const receiver = new Receiver({
  currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY || '',
  nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY || '',
});

export async function POST(req: NextRequest) {
  const signature = req.headers.get('upstash-signature');
  const rawBody = await req.text();

  // Local development bypass support when token is mocked/missing
  const bypassHeader = req.headers.get('x-local-dev-bypass');
  const isDevBypass = 
    (process.env.NODE_ENV === 'development' || 
     !process.env.QSTASH_TOKEN || 
     process.env.QSTASH_TOKEN.startsWith('mock_')) && 
    bypassHeader === 'true';

  if (!isDevBypass) {
    if (!signature) {
      return NextResponse.json({ error: 'Missing QStash signature' }, { status: 401 });
    }

    try {
      const isValid = await receiver.verify({
        signature,
        body: rawBody,
      });

      if (!isValid) {
        return NextResponse.json({ error: 'Invalid QStash signature' }, { status: 401 });
      }
    } catch (err: any) {
      return NextResponse.json({ error: `Signature verification error: ${err.message}` }, { status: 401 });
    }
  }

  try {
    const { agentId, projectId, taskDescription, triggeredBy } = JSON.parse(rawBody);

    if (!agentId || !projectId || !taskDescription || !triggeredBy) {
      return NextResponse.json({ error: 'Missing required payload parameters' }, { status: 400 });
    }

    const supabase = supabaseService.getServiceClient();
    
    // Fetch project owner's user ID
    const { data: project } = await supabase
      .from('projects')
      .select('user_id')
      .eq('id', projectId)
      .single();

    const userId = project?.user_id || '00000000-0000-0000-0000-000000000000';

    // Execute task in non-streaming mode and save to database
    await agentRuntimeService.executeAndSave(
      agentId,
      taskDescription,
      userId,
      triggeredBy
    );

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Error executing task from QStash:', err);
    return NextResponse.json({ error: err.message || String(err) }, { status: 500 });
  }
}
