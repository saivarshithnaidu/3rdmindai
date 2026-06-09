import { NextRequest, NextResponse } from 'next/server';
import codingAgentService from '../../../../services/coding-agent.service';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { sessionId, repo, branch, message, userId } = body;

    if (!sessionId || !repo || !branch || !message) {
      return NextResponse.json({ error: 'Missing required parameters: sessionId, repo, branch, message' }, { status: 400 });
    }

    const prUrl = await codingAgentService.pushToGitHub(
      sessionId,
      repo,
      branch,
      message,
      userId || '00000000-0000-0000-0000-000000000000'
    );

    return NextResponse.json({ success: true, prUrl });
  } catch (err: any) {
    console.error('GitHub push API route failed:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
