import { browserService } from '../browser.service';
import supabaseService from '../supabase.service';
import { emit } from '../../lib/emit';
import { StreamEventType } from '../../lib/stream-events';

export async function scrapeGoogleMaps(
  page: any,
  query: string,
  maxResults: number,
  canvasId: string
): Promise<number> {
  const supabase = supabaseService.getServiceClient();

  let projectId = '00000000-0000-0000-0000-000000000000';
  try {
    const { data: canvas } = await supabase
      .from('canvases')
      .select('project_id')
      .eq('id', canvasId)
      .maybeSingle();
    if (canvas?.project_id) {
      projectId = canvas.project_id;
    }
  } catch (err) {
    console.error('Failed to fetch project_id from canvas:', err);
  }

  // Step 1 — Navigate
  emit(projectId, StreamEventType.BROWSER_NAVIGATING,
    'Navigating to Google Maps',
    { detail: 'https://maps.google.com' });

  await page.goto('https://maps.google.com');
  await browserService.updateCurrentUrlByCanvas(canvasId, 'https://maps.google.com');
  await page.waitForLoadState('networkidle');

  // Step 2 — Search
  emit(projectId, StreamEventType.BROWSER_SEARCHING,
    `Searching Google Maps: "${query}"`);

  await page.fill('input#searchboxinput', query);
  await page.keyboard.press('Enter');
  await page.waitForSelector('.hfpxzc', { timeout: 10000 });

  // Step 3 — Extract results
  let rowIndex = 0;
  let extracted = 0;
  const processedUrls = new Set<string>();

  while (extracted < maxResults) {
    const listings = await page.locator('.hfpxzc').all();
    if (listings.length === 0) break;

    let newItemsFound = false;

    for (const listing of listings) {
      if (extracted >= maxResults) break;

      // Avoid double scraping same listing if it remains in DOM
      const elementId = await listing.getAttribute('href').catch(() => '');
      if (elementId && processedUrls.has(elementId)) {
        continue;
      }
      if (elementId) {
        processedUrls.add(elementId);
      }

      newItemsFound = true;
      try {
        await listing.click();
        await page.waitForTimeout(1500);

        const name = await page.locator('h1.DUwDvf').first().textContent().catch(() => null);
        if (!name) continue;

        const rating = await page.locator('div.F7nice span').first().textContent().catch(() => null);
        const reviews = await page.locator('div.F7nice span').nth(1).textContent().catch(() => null);
        const address = await page.locator('button[data-item-id="address"]').first().textContent().catch(() => null);
        const phone = await page.locator('button[data-item-id*="phone"]').first().textContent().catch(() => null);
        const website = await page.locator('a[data-item-id="authority"]').first().getAttribute('href').catch(() => null);
        const category = await page.locator('button.DkEaL').first().textContent().catch(() => null);

        const row = {
          name: name.trim(),
          rating: rating ? rating.trim() : null,
          reviews: reviews ? reviews.replace(/[()]/g, '').trim() : null,
          address: address ? address.trim() : null,
          phone: phone ? phone.trim() : null,
          website: website ? website.trim() : null,
          category: category ? category.trim() : null,
          url: elementId || null
        };

        await browserService.streamRowToCanvas(canvasId, rowIndex, row, supabase);

        rowIndex++;
        extracted++;

        emit(projectId, StreamEventType.BROWSER_ROW_FOUND,
          `Found: ${row.name}`,
          {
            detail: `${row.address || ''} • ${row.rating || ''}★`,
            data: row,
            progress: Math.round((extracted / maxResults) * 100)
          });

      } catch (err) {
        console.error('Failed to extract Google Maps listing details:', err);
      }
    }

    if (!newItemsFound) {
      // If no new items are processed in a loop iteration, we might have hit the end
      break;
    }

    // Scroll to load more
    try {
      await page.locator('.m6QErb').first().evaluate((el: any) => el.scrollTop += 1500);
      await page.waitForTimeout(1500);
    } catch (e) {
      break;
    }
  }

  emit(projectId, StreamEventType.BROWSER_COMPLETE,
    `Extracted ${extracted} businesses`,
    {
      status: 'done',
      data: { count: extracted }
    });

  return extracted;
}
