import { browserService } from '../browser.service';
import supabaseService from '../supabase.service';

export async function scrapeProductHunt(
  page: any,
  query: string,
  maxResults: number,
  canvasId: string
): Promise<number> {
  const supabase = supabaseService.getServiceClient();

  const targetUrl = `https://www.producthunt.com/search?q=${encodeURIComponent(query)}`;
  await page.goto(targetUrl);
  await browserService.updateCurrentUrlByCanvas(canvasId, targetUrl);
  await page.waitForLoadState('networkidle');

  // Product Hunt search page renders results. Let's select result cards.
  // Standard selectors for search result listings are like '[data-test="post-item"]' or similar layout containers.
  // We can locate items containing product names, taglines, and upvote counters.
  const posts = await page.locator('[data-test^="post-item-"]').all();
  if (posts.length === 0) {
    // Try fallback selectors
    const fallbackPosts = await page.locator('div[class*="styles_item"]').all();
    if (fallbackPosts.length > 0) {
      posts.push(...fallbackPosts);
    }
  }

  let rowIndex = 0;
  let extracted = 0;

  for (const post of posts.slice(0, maxResults)) {
    try {
      const name = await post.locator('[data-test="post-name"], h3').first().textContent().catch(() => null);
      if (!name) continue;

      const tagline = await post.locator('[data-test="post-tagline"], p').first().textContent().catch(() => null);
      const upvotesText = await post.locator('[data-test="vote-button"] [class*="voteCount"], [class*="upvote"]').first().textContent().catch(() => '0');
      const upvotes = parseInt(upvotesText ? upvotesText.replace(/\D/g, '') : '0', 10);
      
      const linkEl = await post.locator('a[href^="/posts/"]').first();
      const relativeUrl = await linkEl.getAttribute('href').catch(() => null);
      const postUrl = relativeUrl ? `https://www.producthunt.com${relativeUrl}` : null;
      
      // Category tag
      const category = await post.locator('a[href^="/topics/"]').first().textContent().catch(() => 'Tech');

      // Website (if we click or load the item, but let's grab the website link or fallback to PH link)
      let website = postUrl;

      const row = {
        name: name.trim(),
        tagline: tagline ? tagline.trim() : '',
        upvotes: isNaN(upvotes) ? 0 : upvotes,
        website: website,
        category: category ? category.trim() : 'Tech',
        launched: new Date().toLocaleDateString(),
        url: postUrl
      };

      await browserService.streamRowToCanvas(canvasId, rowIndex, row, supabase);

      rowIndex++;
      extracted++;
    } catch (err) {
      console.error('Failed to extract Product Hunt listing details:', err);
    }
  }

  return extracted;
}
