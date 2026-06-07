import { browserService } from '../browser.service';
import supabaseService from '../supabase.service';

export async function scrapeGenericWebsite(
  page: any,
  url: string,
  canvasId: string
): Promise<{ title: string; metaDesc: string | null; fullText: string; url: string }> {
  const supabase = supabaseService.getServiceClient();

  // Validate URL format
  let targetUrl = url;
  if (!/^https?:\/\//i.test(targetUrl)) {
    targetUrl = `https://${targetUrl}`;
  }

  await page.goto(targetUrl);
  await browserService.updateCurrentUrlByCanvas(canvasId, targetUrl);
  await page.waitForLoadState('networkidle');

  const fullText = await page.locator('body').innerText().catch(() => '');
  const title = await page.title().catch(() => 'N/A');
  
  // Extract meta description
  const metaDesc = await page
    .locator('meta[name="description"]')
    .first()
    .getAttribute('content')
    .catch(() => null);

  const row = {
    title: title ? title.trim() : 'N/A',
    metaDesc: metaDesc ? metaDesc.trim() : null,
    fullText: fullText ? fullText.trim() : '',
    url: targetUrl
  };

  // Stream single row to canvas
  await browserService.streamRowToCanvas(canvasId, 0, row, supabase);

  return row;
}
