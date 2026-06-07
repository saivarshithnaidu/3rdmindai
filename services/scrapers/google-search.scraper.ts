import { browserService } from '../browser.service';
import supabaseService from '../supabase.service';

export async function scrapeGoogleSearch(
  page: any,
  query: string,
  maxResults: number,
  canvasId: string
): Promise<number> {
  const supabase = supabaseService.getServiceClient();

  const targetUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}&num=${maxResults}`;
  await page.goto(targetUrl);
  await browserService.updateCurrentUrlByCanvas(canvasId, targetUrl);
  await page.waitForLoadState('networkidle');

  const results = await page.locator('div.g').all();

  let rowIndex = 0;
  for (const result of results.slice(0, maxResults)) {
    try {
      const title = await result.locator('h3').first().textContent().catch(() => null);
      const url = await result.locator('a').first().getAttribute('href').catch(() => null);
      
      // Google search snippets are typically inside div.VwiC3b or span elements. Let's try multiple fallbacks.
      let snippet = await result.locator('div.VwiC3b').first().textContent().catch(() => null);
      if (!snippet) {
        snippet = await result.locator('div[style*="-webkit-line-clamp"]').first().textContent().catch(() => null);
      }
      if (!snippet) {
        snippet = await result.locator('.yDHt8b').first().textContent().catch(() => null);
      }

      await browserService.streamRowToCanvas(
        canvasId,
        rowIndex,
        {
          title: title ? title.trim() : 'N/A',
          url: url ? url.trim() : null,
          snippet: snippet ? snippet.trim() : ''
        },
        supabase
      );

      rowIndex++;
    } catch (err) {
      console.error('Failed to extract Google Search result detail:', err);
    }
  }

  return rowIndex;
}
