import { NextRequest, NextResponse } from 'next/server';
import agentRuntimeService from '../../../../services/agent-runtime.service';

export async function POST(req: NextRequest) {
  try {
    const { projectId, userId, startupContext } = await req.json();

    if (!projectId || !userId || !startupContext) {
      return NextResponse.json(
        { error: 'Missing projectId, userId, or startupContext' },
        { status: 400 }
      );
    }

    const agents = await agentRuntimeService.deployStartupTeam(
      projectId,
      userId,
      startupContext
    );

    return NextResponse.json({ agents });
  } catch (err: any) {
    console.error('Error in startup-agents deploy route:', err);
    return NextResponse.json(
      { error: err.message || String(err) },
      { status: 500 }
    );
  }
}
