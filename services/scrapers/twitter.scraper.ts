import { browserService } from '../browser.service';
import supabaseService from '../supabase.service';

export async function scrapeTwitterSearch(
  page: any,
  query: string,
  maxResults: number,
  canvasId: string
): Promise<number> {
  const supabase = supabaseService.getServiceClient();

  const targetUrl = `https://twitter.com/search?q=${encodeURIComponent(query)}&f=live`;
  await page.goto(targetUrl);
  await browserService.updateCurrentUrlByCanvas(canvasId, targetUrl);
  await page.waitForTimeout(3000); // Wait for potential login redirects or data load

  // Check for login wall
  if (page.url().includes('login') || page.url().includes('flow/login')) {
    console.warn('Twitter requires login for search. Returning 0 tweets.');
    // In production, we'd inject cookies just like LinkedIn. Since they're not logged in, we return 0.
    throw new Error('Twitter / X requires authentication. Please log in or link your X account in connectors.');
  }

  let rowIndex = 0;
  let extracted = 0;

  // Locate tweet articles
  const tweets = await page.locator('article[data-testid="tweet"]').all();
  
  for (const tweet of tweets.slice(0, maxResults)) {
    try {
      // Extract author name and handle
      const nameEl = await tweet.locator('[data-testid="User-Name"]').first();
      const userNameText = await nameEl.textContent().catch(() => '');
      // E.g. "John Doe@johndoe·1h"
      const parts = userNameText.split('@');
      const author = parts[0] || 'N/A';
      const handle = parts[1] ? `@${parts[1].split('·')[0]}` : 'N/A';
      
      const content = await tweet.locator('[data-testid="tweetText"]').first().textContent().catch(() => '');
      
      // Metrics
      const likesText = await tweet.locator('[data-testid="like"]').first().textContent().catch(() => '0');
      const likes = parseInt(likesText.replace(/\D/g, '') || '0', 10);
      
      const retweetsText = await tweet.locator('[data-testid="retweet"]').first().textContent().catch(() => '0');
      const retweets = parseInt(retweetsText.replace(/\D/g, '') || '0', 10);
      
      // Tweet date and link
      const timeEl = await tweet.locator('time').first();
      const date = await timeEl.getAttribute('datetime').catch(() => new Date().toISOString());
      
      const linkEl = await tweet.locator('a[href*="/status/"]').first();
      const relativeUrl = await linkEl.getAttribute('href').catch(() => null);
      const url = relativeUrl ? `https://twitter.com${relativeUrl}` : null;

      const row = {
        author: author.trim(),
        handle: handle.trim(),
        content: content.trim(),
        likes: isNaN(likes) ? 0 : likes,
        retweets: isNaN(retweets) ? 0 : retweets,
        date: date,
        url: url
      };

      await browserService.streamRowToCanvas(canvasId, rowIndex, row, supabase);

      rowIndex++;
      extracted++;
    } catch (err) {
      console.error('Failed to extract tweet details:', err);
    }
  }

  return extracted;
}
