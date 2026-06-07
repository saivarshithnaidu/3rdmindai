import { browserService } from '../browser.service';
import supabaseService from '../supabase.service';

export async function scrapeLinkedInCompanies(
  page: any,
  query: string,
  maxResults: number,
  canvasId: string
): Promise<number> {
  const supabase = supabaseService.getServiceClient();

  // 1. Fetch canvas to get project_id
  const { data: canvas, error: canvasErr } = await supabase
    .from('canvases')
    .select('project_id')
    .eq('id', canvasId)
    .single();

  if (canvasErr || !canvas) {
    throw new Error('Canvas not found');
  }

  // 2. Check if LinkedIn connector is active
  const { data: connector, error: connectorErr } = await supabase
    .from('connectors')
    .select('*')
    .eq('project_id', canvas.project_id)
    .eq('slug', 'linkedin')
    .eq('is_active', true)
    .maybeSingle();

  if (connectorErr || !connector) {
    throw new Error('LinkedIn not connected');
  }

  // 3. Navigate to LinkedIn company search or public profile (mocked/simulated or using authenticated cookie if stored in connector metadata)
  // For the sake of this agent, we will attempt to search public company listings or simulate the behavior
  await page.goto(`https://www.linkedin.com/search/results/companies/?keywords=${encodeURIComponent(query)}`);
  await page.waitForLoadState('networkidle');

  // Let's check if we get redirected to login. If so, and we have cookies in metadata, we could inject them.
  const isLoginPage = page.url().includes('login') || await page.locator('input#username').count() > 0;
  if (isLoginPage && connector.metadata?.cookies) {
    try {
      await page.context().addCookies(connector.metadata.cookies);
      await page.reload();
      await page.waitForLoadState('networkidle');
    } catch (cookieErr) {
      console.error('Failed to restore LinkedIn cookies:', cookieErr);
    }
  }

  // Check login state again
  if (page.url().includes('login') || await page.locator('input#username').count() > 0) {
    throw new Error('LinkedIn session expired or not authenticated. Please re-authenticate your LinkedIn account.');
  }

  // Extract company items from results page
  const searchResults = await page.locator('.reusable-search__result-container').all();
  let rowIndex = 0;
  let extracted = 0;

  for (const result of searchResults.slice(0, maxResults)) {
    try {
      // Click the result to view details or extract directly from the summary
      const titleLink = await result.locator('span.entity-result__title-text a').first();
      const name = await titleLink.textContent().catch(() => null);
      const url = await titleLink.getAttribute('href').catch(() => null);
      
      const snippetText = await result.locator('.entity-result__primary-subtitle').first().textContent().catch(() => null);
      // E.g. "Software Development • San Francisco, CA • 10,001+ employees"
      const parts = snippetText ? snippetText.split('•').map((s: string) => s.trim()) : [];
      const industry = parts[0] || 'N/A';
      const location = parts[1] || 'N/A';
      const size = parts[2] || 'N/A';

      await browserService.streamRowToCanvas(
        canvasId,
        rowIndex,
        {
          name: name ? name.trim() : 'N/A',
          website: url ? url.split('?')[0] : null,
          industry,
          location,
          size,
          follower_count: 'N/A'
        },
        supabase
      );

      rowIndex++;
      extracted++;
    } catch (err) {
      console.error('Failed to extract LinkedIn company detail:', err);
    }
  }

  return extracted;
}
