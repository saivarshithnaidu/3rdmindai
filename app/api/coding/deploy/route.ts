import { NextRequest, NextResponse } from 'next/server';
import autoDeployService from '../../../../services/auto-deploy.service';
import { qstashClient } from '../../../../lib/qstash';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { sessionId, projectId } = body;

    if (!sessionId || !projectId) {
      return NextResponse.json({ error: 'Missing parameters: sessionId, projectId' }, { status: 400 });
    }

    const appUrl = process.env.APP_URL || 'https://3rdmind.ai';
    const qstashToken = process.env.QSTASH_TOKEN || '';

    if (!qstashToken || qstashToken.startsWith('mock_')) {
      console.warn('[QStash offline simulator] Triggering autoDeployPipeline locally.');
      
      // Asynchronously call the deploy pipeline
      setTimeout(async () => {
        try {
          await autoDeployService.autoDeployPipeline(sessionId, projectId);
        } catch (err) {
          console.error('[QStash offline simulator] autoDeployPipeline failed:', err);
        }
      }, 100);
    } else {
      // Production QStash publish
      await qstashClient.publishJSON({
        url: `${appUrl}/api/coding/deploy/worker`,
        body: { sessionId, projectId },
        retries: 3
      });
    }

    return NextResponse.json({ success: true, message: 'Deployment pipeline queued' });
  } catch (err: any) {
    console.error('Deploy API route failed:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
