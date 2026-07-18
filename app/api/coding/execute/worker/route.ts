import { NextRequest, NextResponse } from 'next/server';
import codeExecutorService from '../../../../../services/code-executor.service';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { sessionId, projectId } = body;

    if (!sessionId || !projectId) {
      return NextResponse.json({ error: 'Missing parameters: sessionId, projectId' }, { status: 400 });
    }

    await codeExecutorService.selfHealingBuild(sessionId, projectId);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('QStash execution worker failed:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
