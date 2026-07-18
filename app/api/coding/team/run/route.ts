import { NextRequest, NextResponse } from 'next/server';
import codeTeamService from '../../../../../services/code-team.service';
import { qstashClient } from '../../../../../lib/qstash';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { teamId, projectId } = body;

    if (!teamId || !projectId) {
      return NextResponse.json({ error: 'Missing parameters: teamId, projectId' }, { status: 400 });
    }

    const appUrl = process.env.APP_URL || 'https://3rdmind.ai';
    const qstashToken = process.env.QSTASH_TOKEN || '';

    if (!qstashToken || qstashToken.startsWith('mock_')) {
      console.warn('[QStash offline simulator] Triggering runCodeTeam locally.');
      
      // Asynchronously call the team run
      setTimeout(async () => {
        try {
          await codeTeamService.runCodeTeam(teamId, projectId);
        } catch (err) {
          console.error('[QStash offline simulator] runCodeTeam failed:', err);
        }
      }, 100);
    } else {
      // Production QStash publish
      await qstashClient.publishJSON({
        url: `${appUrl}/api/coding/team/worker`,
        body: { teamId, projectId },
        retries: 3
      });
    }

    return NextResponse.json({ success: true, message: 'Team pipeline execution triggered' });
  } catch (err: any) {
    console.error('Run team API route failed:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
