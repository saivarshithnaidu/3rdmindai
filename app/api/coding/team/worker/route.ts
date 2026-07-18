import { NextRequest, NextResponse } from 'next/server';
import codeTeamService from '../../../../../services/code-team.service';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { teamId, projectId } = body;

    if (!teamId || !projectId) {
      return NextResponse.json({ error: 'Missing parameters: teamId, projectId' }, { status: 400 });
    }

    await codeTeamService.runCodeTeam(teamId, projectId);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('QStash team run worker failed:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
