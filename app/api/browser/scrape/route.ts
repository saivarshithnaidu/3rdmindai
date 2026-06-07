import { NextRequest, NextResponse } from 'next/server';
import { Receiver } from '@upstash/qstash';
import browserAgentService from '../../../../services/browser-agent.service';
import { qstashClient } from '../../../../lib/qstash';
import { SCRAPER_CONFIGS } from '../../../../lib/scrapers.registry';
import { dataAgentService } from '../../../../services/data-agent.service';

const receiver = new Receiver({
  currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY || '',
  nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY || '',
});

export async function POST(req: NextRequest) {
  const isQStash = req.headers.has('upstash-signature') || req.headers.get('x-local-dev-bypass') === 'true';

  if (isQStash) {
    // ----------------------------------------------------
    // BACKGROUND EXECUTION (Triggered by QStash / Simulator)
    // ----------------------------------------------------
    const signature = req.headers.get('upstash-signature');
    const rawBody = await req.text();
    const bypassHeader = req.headers.get('x-local-dev-bypass');
    
    const isDevBypass = 
      (process.env.NODE_ENV === 'development' || 
       !process.env.QSTASH_TOKEN || 
       process.env.QSTASH_TOKEN.startsWith('mock_')) && 
      bypassHeader === 'true';

    if (!isDevBypass) {
      if (!signature) {
        return NextResponse.json({ error: 'Missing QStash signature' }, { status: 401 });
      }
      try {
        const isValid = await receiver.verify({
          signature,
          body: rawBody,
        });
        if (!isValid) {
          return NextResponse.json({ error: 'Invalid QStash signature' }, { status: 401 });
        }
      } catch (err: any) {
        return NextResponse.json({ error: `Signature verification error: ${err.message}` }, { status: 401 });
      }
    }

    try {
      const { projectId, agentId, scraperType, query, maxResults, canvasId } = JSON.parse(rawBody);
      
      await browserAgentService.runBrowserScrape(
        projectId,
        agentId || null,
        null,
        scraperType,
        query,
        maxResults,
        canvasId
      );

      return NextResponse.json({ success: true });
    } catch (err: any) {
      console.error('Error running background browser scrape:', err);
      return NextResponse.json({ error: err.message || String(err) }, { status: 500 });
    }

  } else {
    // ----------------------------------------------------
    // USER INBOUND (Triggered from UI or orchestrator)
    // ----------------------------------------------------
    try {
      const { projectId, agentId, scraperType, query, maxResults: reqMaxResults, canvasId: reqCanvasId } = await req.json();

      if (!projectId || !scraperType || !query) {
        return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
      }

      const config = SCRAPER_CONFIGS.find(c => c.id === scraperType);
      if (!config) {
        return NextResponse.json({ error: `Unknown scraper type: ${scraperType}` }, { status: 400 });
      }

      const maxResults = reqMaxResults || config.maxResults || 20;

      // 1. Initialize canvas immediately so we can return its ID
      let canvasId = reqCanvasId;
      if (!canvasId) {
        const canvasName = `${config.name} Scraping: "${query}"`;
        const canvas = await dataAgentService.createCanvas(
          projectId,
          null,
          canvasName,
          config.columns,
          'search',
          maxResults
        );
        canvasId = canvas.id;
      }

      const appUrl = process.env.APP_URL || 'https://3rdmind.ai';
      const scrapeUrl = `${appUrl}/api/browser/scrape`;
      const qstashToken = process.env.QSTASH_TOKEN || '';

      const payload = {
        projectId,
        agentId: agentId || null,
        scraperType,
        query,
        maxResults,
        canvasId,
      };

      // 2. Queue in QStash or run local simulation
      if (!qstashToken || qstashToken.startsWith('mock_')) {
        console.warn('[QStash offline simulator] Triggering browser scrape locally.');
        
        setTimeout(async () => {
          try {
            const localScrapeUrl = `${appUrl.startsWith('https://3rdmind.ai') ? 'http://localhost:3000' : appUrl}/api/browser/scrape`;
            await fetch(localScrapeUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-local-dev-bypass': 'true'
              },
              body: JSON.stringify(payload)
            });
          } catch (err) {
            console.error('[QStash offline simulator] Failed to invoke scrape route:', err);
          }
        }, 100);
      } else {
        await qstashClient.publishJSON({
          url: scrapeUrl,
          body: payload,
          retries: 3,
        });
      }

      // Return running status immediately (under 3 seconds)
      return NextResponse.json({
        status: 'running',
        rowsExtracted: 0,
        canvasId
      });
    } catch (err: any) {
      console.error('Error handling user scrape request:', err);
      return NextResponse.json({ error: err.message || String(err) }, { status: 500 });
    }
  }
}
