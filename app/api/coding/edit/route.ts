import { NextRequest, NextResponse } from 'next/server';
import codingAgentService from '../../../../services/coding-agent.service';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { sessionId, instruction, filePaths } = body;

    if (!sessionId || !instruction || !filePaths || !Array.isArray(filePaths)) {
      return NextResponse.json({ error: 'Missing required parameters: sessionId, instruction, filePaths' }, { status: 400 });
    }

    const updatedFiles = await codingAgentService.editCode(sessionId, instruction, filePaths);

    return NextResponse.json({ success: true, updatedFiles });
  } catch (err: any) {
    console.error('Edit API route failed:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
