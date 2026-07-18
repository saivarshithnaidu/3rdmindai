import { NextRequest, NextResponse } from 'next/server';
import codebaseIntelligenceService from '../../../../../services/codebase-intelligence.service';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const projectId = formData.get('projectId') as string | null;

    if (!file || !projectId) {
      return NextResponse.json({ error: 'Missing required parameters: file, projectId' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // ZIP extraction is relatively fast, so we run it inline or handle as async.
    // Let's run it inline but return progress so user gets instant confirmation.
    const result = await codebaseIntelligenceService.indexCodebase(projectId, 'upload', buffer);

    return NextResponse.json({ success: true, result });
  } catch (err: any) {
    console.error('ZIP Codebase index API failed:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
