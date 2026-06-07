import { openrouterService } from './openrouter.service';
import { browserService } from './browser.service';
import { dataAgentService } from './data-agent.service';
import { SCRAPER_CONFIGS } from '../lib/scrapers.registry';
import supabaseService from './supabase.service';
import { scrapeGoogleMaps } from './scrapers/google-maps.scraper';
import { scrapeGoogleSearch } from './scrapers/google-search.scraper';
import { scrapeLinkedInCompanies } from './scrapers/linkedin.scraper';
import { scrapeProductHunt } from './scrapers/producthunt.scraper';
import { scrapeTwitterSearch } from './scrapers/twitter.scraper';
import { scrapeYCCompanies } from './scrapers/ycombinator.scraper';
import { scrapeGenericWebsite } from './scrapers/generic-website.scraper';
import { qstashClient } from '../lib/qstash';

export const browserAgentService = {
  async detectBrowserRequest(message: string): Promise<{
    needsBrowser: boolean;
    scraper: 'google-maps' | 'google-search' | 'producthunt' | 'twitter' | 'ycombinator' | 'generic' | null;
    query: string;
    url: string | null;
    maxResults: number;
    reason: string;
  }> {
    const system = `You are a browser intent classifier. Decide if a user query requires real-time web scraping, local business search, product launch listings, social media searches, or opening a specific web URL.
Respond ONLY with a JSON object. No markdown formatting.

Available Scrapers:
- 'google-maps': Local business research (agencies, offices, restaurants, gyms, stores in a specific location).
- 'google-search': Search queries for web links, news, research topics, competitive landscape.
- 'producthunt': Finding newly launched software, products, competitors.
- 'twitter': Social sentiment, X/Twitter posts tracking, trending topics.
- 'ycombinator': Startups, founders, YC company directory.
- 'generic': Extracting pricing or content from a specific URL.

Response JSON format:
{
  "needsBrowser": boolean,
  "scraper": "google-maps" | "google-search" | "producthunt" | "twitter" | "ycombinator" | "generic" | null,
  "query": "The search query or target website URL",
  "url": "Website URL if generic scraper is needed, otherwise null",
  "maxResults": number, // Default to 20. For generic website, maxResults is 1.
  "reason": "Short reason for why this scraper was selected"
}
`;

    try {
      const responseText = await openrouterService.callModel(
        system,
        [{ role: 'user', content: message }],
        'deepseek/deepseek-chat'
      );

      const cleaned = responseText.replace(/```json/gi, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleaned);
      return parsed;
    } catch (err) {
      console.error('Failed to detect browser request:', err);
      return {
        needsBrowser: false,
        scraper: null,
        query: '',
        url: null,
        maxResults: 20,
        reason: 'Error occurred during classification'
      };
    }
  },

  async runBrowserScrape(
    projectId: string,
    agentId: string | null,
    userId: string | null,
    scraperType: 'google-maps' | 'google-search' | 'producthunt' | 'twitter' | 'ycombinator' | 'generic',
    query: string,
    maxResults: number,
    canvasIdParam?: string
  ): Promise<{ canvasId: string; rowsExtracted: number; liveViewUrl: string }> {
    const supabase = supabaseService.getServiceClient();
    const config = SCRAPER_CONFIGS.find((c) => c.id === scraperType);
    if (!config) {
      throw new Error(`Unknown scraper type: ${scraperType}`);
    }

    // 1. Initialize Live Data Canvas
    let canvasId = canvasIdParam;
    if (!canvasId) {
      const canvasName = `${config.name} Scraping: "${query}"`;
      const canvas = await dataAgentService.createCanvas(
        projectId,
        null, // We store agent ID inside browser_sessions to prevent canvas RLS schema issues or let it bind to canvas
        canvasName,
        config.columns,
        'search',
        maxResults
      );
      canvasId = canvas.id;
    }

    // 2. Create browser session
    const { sessionId, liveViewUrl, dbId } = await browserService.createSession(
      projectId,
      agentId,
      scraperType,
      query
    );

    // 3. Link canvas_id in browser_session
    await supabase
      .from('browser_sessions')
      .update({ canvas_id: canvasId })
      .eq('id', dbId);

    // 4. Connect to browser and execute scraper
    let browserInstance = null;
    let rowsExtracted = 0;
    let scraperError = null;

    try {
      const { browser, page } = await browserService.connectToSession(sessionId);
      browserInstance = browser;

      switch (scraperType) {
        case 'google-maps':
          rowsExtracted = await scrapeGoogleMaps(page, query, maxResults, canvasId);
          break;
        case 'google-search':
          rowsExtracted = await scrapeGoogleSearch(page, query, maxResults, canvasId);
          break;
        case 'producthunt':
          rowsExtracted = await scrapeProductHunt(page, query, maxResults, canvasId);
          break;
        case 'twitter':
          rowsExtracted = await scrapeTwitterSearch(page, query, maxResults, canvasId);
          break;
        case 'ycombinator':
          rowsExtracted = await scrapeYCCompanies(page, query, maxResults, canvasId);
          break;
        case 'generic':
          await scrapeGenericWebsite(page, query, canvasId);
          rowsExtracted = 1;
          break;
        default:
          throw new Error(`Scraper type ${scraperType} not implemented.`);
      }

      // Finalize canvas to done
      await dataAgentService.finalizeCanvas(canvasId, 'done');
    } catch (err: any) {
      console.error(`Scraping run encountered an error: ${err.message || err}`);
      scraperError = err;
      await dataAgentService.finalizeCanvas(canvasId, 'error');
    } finally {
      // Close browser session and save details
      await browserService.closeSession(
        browserInstance,
        sessionId,
        dbId,
        rowsExtracted,
        scraperError ? 'error' : 'completed'
      );
    }

    if (scraperError) {
      throw scraperError;
    }

    return {
      canvasId,
      rowsExtracted,
      liveViewUrl
    };
  }
};

export default browserAgentService;
