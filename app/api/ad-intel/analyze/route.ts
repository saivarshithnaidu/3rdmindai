import { NextRequest } from 'next/server';
import adIntelligenceService from '../../../../services/ad-intelligence.service';

export async function POST(req: NextRequest) {
  try {
    const { competitorUrl, projectId, userId } = await req.json();

    if (!competitorUrl || !projectId || !userId) {
      return new Response(JSON.stringify({ error: 'Missing required parameters' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        try {
          const onProgress = (msg: string) => {
            controller.enqueue(encoder.encode(JSON.stringify({ type: 'progress', message: msg }) + '\n'));
          };

          const reportId = await adIntelligenceService.runAnalysisPipeline(
            competitorUrl,
            projectId,
            userId,
            onProgress
          );

          controller.enqueue(encoder.encode(JSON.stringify({ type: 'complete', reportId }) + '\n'));
        } catch (err: any) {
          console.error('Error in analysis pipeline:', err);
          controller.enqueue(encoder.encode(JSON.stringify({ type: 'error', error: err.message || String(err) }) + '\n'));
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
      },
    });
  } catch (e: any) {
    console.error('Error in ad-intel analyze API:', e);
    return new Response(JSON.stringify({ error: e.message || String(e) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
