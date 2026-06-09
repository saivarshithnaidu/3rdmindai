import { NextRequest, NextResponse } from 'next/server';
import codingAgentService from '../../../../services/coding-agent.service';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { sessionId, plan, stack, description } = body;

    if (!sessionId || !plan || !stack || !description) {
      return NextResponse.json({ error: 'Missing required parameters: sessionId, plan, stack, description' }, { status: 400 });
    }

    // Run build project. This will stream progress to Supabase and emit progress events.
    const result = await codingAgentService.buildProject(sessionId, description, plan, stack);

    return NextResponse.json({ success: true, result });
  } catch (err: any) {
    console.error('Build API route failed:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
