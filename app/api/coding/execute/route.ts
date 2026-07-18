import { NextRequest, NextResponse } from 'next/server';
import codeExecutorService from '../../../../services/code-executor.service';
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
      console.warn('[QStash offline simulator] Triggering selfHealingBuild locally.');
      
      // Asynchronously call the executor
      setTimeout(async () => {
        try {
          await codeExecutorService.selfHealingBuild(sessionId, projectId);
        } catch (err) {
          console.error('[QStash offline simulator] selfHealingBuild failed:', err);
        }
      }, 100);
    } else {
      // Production QStash publish
      await qstashClient.publishJSON({
        url: `${appUrl}/api/coding/execute/worker`,
        body: { sessionId, projectId },
        retries: 3
      });
    }

    return NextResponse.json({ success: true, message: 'Execution and repair task queued' });
  } catch (err: any) {
    console.error('Execute API route failed:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
