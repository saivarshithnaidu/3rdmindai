import { NextRequest, NextResponse } from 'next/server';
import codeTeamService from '../../../../../services/code-team.service';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { description, projectId, sessionId } = body;

    if (!description || !projectId || !sessionId) {
      return NextResponse.json({ error: 'Missing parameters: description, projectId, sessionId' }, { status: 400 });
    }

    const teamConfig = await codeTeamService.assembleCodeTeam(description, projectId, sessionId);

    return NextResponse.json({ success: true, teamConfig });
  } catch (err: any) {
    console.error('Assemble team API failed:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
