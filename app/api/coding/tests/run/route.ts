import { NextRequest, NextResponse } from 'next/server';
import codingAgentService from '../../../../../services/coding-agent.service';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { sessionId, projectId, framework } = body;

    if (!sessionId || !projectId) {
      return NextResponse.json({ error: 'Missing parameters: sessionId, projectId' }, { status: 400 });
    }

    const testFramework = framework || 'jest';
    const result = await codingAgentService.generateAndRunTests(sessionId, projectId, testFramework);

    return NextResponse.json({ success: true, result });
  } catch (err: any) {
    console.error('Run tests API route failed:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
