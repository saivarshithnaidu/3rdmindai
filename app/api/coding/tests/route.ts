import { NextRequest, NextResponse } from 'next/server';
import codingAgentService from '../../../../services/coding-agent.service';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { sessionId, filePath, framework } = body;

    if (!sessionId || !filePath || !framework) {
      return NextResponse.json({ error: 'Missing required parameters: sessionId, filePath, framework' }, { status: 400 });
    }

    const testFile = await codingAgentService.generateTests(sessionId, filePath, framework);

    return NextResponse.json({ success: true, testFile });
  } catch (err: any) {
    console.error('Tests API route failed:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
