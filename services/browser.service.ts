import Browserbase from '@browserbasehq/sdk';
import { chromium, Browser } from 'playwright';
import supabaseService from './supabase.service';

const apiKey = process.env.BROWSERBASE_API_KEY;
const projectId = process.env.BROWSERBASE_PROJECT_ID;

const bb = apiKey ? new Browserbase({ apiKey }) : null;

export const browserService = {
  async createSession(
    projectIdParam: string,
    agentId: string | null,
    scraperType: string,
    query: string
  ): Promise<{ sessionId: string; liveViewUrl: string; dbId: string }> {
    if (!bb || !projectId) {
      throw new Error('Browserbase credentials (BROWSERBASE_API_KEY and BROWSERBASE_PROJECT_ID) are not configured.');
    }

    // 1. Create Browserbase Session
    const session = (await bb.sessions.create({
      projectId
    })) as any;

    const sessionId = session.id;
    // debuggerFullscreenUrl provides the live view iframe source
    const liveViewUrl = session.debuggerFullscreenUrl;

    // 2. Save session to database
    const supabase = supabaseService.getServiceClient();
    const { data: dbSession, error } = await supabase
      .from('browser_sessions')
      .insert({
        project_id: projectIdParam,
        agent_id: agentId,
        session_id: sessionId,
        live_view_url: liveViewUrl,
        status: 'active',
        scraper_type: scraperType,
        query: query,
        rows_extracted: 0
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to save browser session to database: ${error.message}`);
    }

    return {
      sessionId,
      liveViewUrl,
      dbId: dbSession.id
    };
  },

  async connectToSession(sessionId: string): Promise<{ browser: Browser; page: any }> {
    if (!apiKey) {
      throw new Error('BROWSERBASE_API_KEY is not configured.');
    }

    const browser = await chromium.connectOverCDP(
      `wss://connect.browserbase.com?apiKey=${apiKey}&sessionId=${sessionId}`
    );

    // Get the default context page if it exists, otherwise create a new one
    const contexts = browser.contexts();
    let page;
    if (contexts.length > 0) {
      const pages = contexts[0].pages();
      if (pages.length > 0) {
        page = pages[0];
      }
    }

    if (!page) {
      page = await browser.newPage();
    }

    return { browser, page };
  },

  async closeSession(
    browser: Browser | null,
    sessionId: string,
    dbId: string,
    rowCount: number,
    status: 'completed' | 'error' = 'completed'
  ): Promise<void> {
    try {
      if (browser) {
        await browser.close();
      }
    } catch (err) {
      console.error(`Failed to close browser for session ${sessionId}:`, err);
    }

    const supabase = supabaseService.getServiceClient();
    await supabase
      .from('browser_sessions')
      .update({
        status,
        rows_extracted: rowCount
      })
      .eq('id', dbId);
  },

  async updateCurrentUrlByCanvas(canvasId: string, url: string): Promise<void> {
    const supabase = supabaseService.getServiceClient();
    const { data: session, error } = await supabase
      .from('browser_sessions')
      .select('id')
      .eq('canvas_id', canvasId)
      .eq('status', 'active')
      .maybeSingle();

    if (!error && session) {
      await supabase
        .from('browser_sessions')
        .update({ current_url: url })
        .eq('id', session.id);
    }
  },

  async streamRowToCanvas(
    canvasId: string,
    rowIndex: number,
    data: any,
    supabase: any
  ): Promise<void> {
    // 1. Insert row to canvas_rows table
    const { error: insertErr } = await supabase
      .from('canvas_rows')
      .insert({
        canvas_id: canvasId,
        row_index: rowIndex,
        data,
        sources: data.url ? [data.url] : []
      });

    if (insertErr) {
      console.error(`Failed to insert row to canvas_rows: ${insertErr.message}`);
      return;
    }

    // 2. Increment rows_done in canvases
    await supabase.rpc('increment_canvas_rows_done', { canvas_id_param: canvasId });

    // 3. Find active browser session for this canvas and increment rows_extracted
    const { data: session, error: sessionErr } = await supabase
      .from('browser_sessions')
      .select('id, rows_extracted')
      .eq('canvas_id', canvasId)
      .single();

    if (!sessionErr && session) {
      await supabase
        .from('browser_sessions')
        .update({ rows_extracted: (session.rows_extracted || 0) + 1 })
        .eq('id', session.id);
    }
  }
};

export default browserService;
