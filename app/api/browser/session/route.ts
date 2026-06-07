import { NextRequest, NextResponse } from 'next/server';
import { browserService } from '../../../../services/browser.service';

export async function POST(req: NextRequest) {
  try {
    const { projectId, agentId, scraperType, query } = await req.json();

    if (!projectId || !scraperType || !query) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    const { sessionId, liveViewUrl, dbId } = await browserService.createSession(
      projectId,
      agentId || null,
      scraperType,
      query
    );

    return NextResponse.json({
      sessionId,
      liveViewUrl,
      dbSessionId: dbId
    });
  } catch (err: any) {
    console.error('Error creating browser session:', err);
    return NextResponse.json({ error: err.message || String(err) }, { status: 500 });
  }
}
