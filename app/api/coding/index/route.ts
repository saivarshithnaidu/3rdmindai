import { NextRequest, NextResponse } from 'next/server';
import codebaseIntelligenceService from '../../../../services/codebase-intelligence.service';
import { qstashClient } from '../../../../lib/qstash';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { projectId, source, githubRepo, userId } = body;

    if (!projectId || !source) {
      return NextResponse.json({ error: 'Missing required parameters: projectId, source' }, { status: 400 });
    }

    const appUrl = process.env.APP_URL || 'https://3rdmind.ai';
    const qstashToken = process.env.QSTASH_TOKEN || '';

    // Asynchronous triggering
    if (!qstashToken || qstashToken.startsWith('mock_')) {
      console.warn('[QStash offline simulator] Triggering codebase indexing locally.');
      
      // Asynchronously call the indexer
      setTimeout(async () => {
        try {
          if (source === 'github') {
            await codebaseIntelligenceService.indexCodebase(projectId, 'github', {
              repo: githubRepo,
              userId: userId || '00000000-0000-0000-0000-000000000000'
            });
          } else if (source === 'session') {
            const { sessionId } = body;
            await codebaseIntelligenceService.indexCodebase(projectId, 'session', { sessionId });
          }
        } catch (err) {
          console.error('[QStash offline simulator] Codebase indexing failed:', err);
        }
      }, 100);
    } else {
      // Production QStash publish
      await qstashClient.publishJSON({
        url: `${appUrl}/api/coding/index/worker`,
        body: {
          projectId,
          source,
          githubRepo,
          userId,
          sessionId: body.sessionId
        },
        retries: 3
      });
    }

    return NextResponse.json({ success: true, message: 'Indexing task queued' });
  } catch (err: any) {
    console.error('Codebase index API failed:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
