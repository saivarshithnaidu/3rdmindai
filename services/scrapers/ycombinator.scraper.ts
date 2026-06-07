import { browserService } from '../browser.service';
import supabaseService from '../supabase.service';

export async function scrapeYCCompanies(
  page: any,
  query: string,
  maxResults: number,
  canvasId: string
): Promise<number> {
  const supabase = supabaseService.getServiceClient();

  const targetUrl = `https://www.ycombinator.com/companies?query=${encodeURIComponent(query)}`;
  await page.goto(targetUrl);
  await browserService.updateCurrentUrlByCanvas(canvasId, targetUrl);
  await page.waitForLoadState('networkidle');

  // Let's locate the cards. The cards on the YC Directory are links starting with /companies/
  const cards = await page.locator('a[href^="/companies/"]').all();
  if (cards.length === 0) {
    // Try a broader query if cards aren't found
    const alternativeCards = await page.locator('.ycdc-card, ._coCard_11g0s_26').all();
    if (alternativeCards.length > 0) {
      cards.push(...alternativeCards);
    }
  }

  let rowIndex = 0;
  let extracted = 0;

  for (const card of cards.slice(0, maxResults)) {
    try {
      // Relative or absolute URL of the company detail page
      const relativeUrl = await card.getAttribute('href').catch(() => null);
      const companyUrl = relativeUrl ? `https://www.ycombinator.com${relativeUrl}` : null;

      // Extract details inside the card
      const name = await card.locator('span[class*="coName"], ._coName_11g0s_135, font').first().textContent().catch(() => null);
      if (!name) continue;

      const batch = await card.locator('span[class*="coBatch"], ._coBatch_11g0s_144').first().textContent().catch(() => 'N/A');
      const description = await card.locator('p[class*="coDescription"], ._coDescription_11g0s_253').first().textContent().catch(() => '');
      
      // Location and tags are typically in pill containers
      const pillsText = await card.locator('span[class*="pill"], ._pill_11g0s_189').allTextContents().catch(() => []);
      const location = pillsText[0] || 'N/A';
      const tags = pillsText.slice(1).join(', ') || 'N/A';

      // Website is typically the company website, but since we are on the card list, we can fall back to the YC page url.
      // In a real execution, we would go to the companyUrl to extract the real company website, but to keep it fast, we can save companyUrl as the website or YC URL.
      const website = companyUrl;

      const row = {
        name: name.trim(),
        batch: batch ? batch.trim() : 'N/A',
        description: description ? description.trim() : '',
        website: website,
        tags: tags,
        team_size: 'N/A',
        location: location ? location.trim() : 'N/A'
      };

      await browserService.streamRowToCanvas(canvasId, rowIndex, row, supabase);

      rowIndex++;
      extracted++;
    } catch (err) {
      console.error('Failed to extract YC company details:', err);
    }
  }

  return extracted;
}
