import { chromium } from 'playwright';
import Browserbase from '@browserbasehq/sdk';
import supabaseService from './supabase.service';
import { PriceWatch, WatchPlatform } from '../types';
import { scrapeAmazon } from './scrapers/amazon.scraper';
import { scrapeFlipkart } from './scrapers/flipkart.scraper';
import { scrapeMeesho } from './scrapers/meesho.scraper';
import priceAlertService from './price-alert.service';

const apiKey = process.env.BROWSERBASE_API_KEY;
const projectId = process.env.BROWSERBASE_PROJECT_ID;

export const priceWatchService = {
  /**
   * Scrapes product details using either Browserbase (if configured) or local Playwright fallback.
   * Ensures browser sessions are closed immediately after scraping to prevent resources from dangling.
   */
  async scrapeProduct(url: string, platform: WatchPlatform): Promise<{
    productName: string;
    price: number | null;
    originalPrice: number | null;
    inStock: boolean;
    imageUrl: string | null;
  }> {
    let browserInstance: any = null;
    let page: any = null;
    let isBrowserbase = false;
    let sessionId = '';

    try {
      if (apiKey && projectId) {
        // 1. Create Browserbase Session
        const bb = new Browserbase({ apiKey });
        const session = (await bb.sessions.create({ projectId })) as any;
        sessionId = session.id;
        
        // 2. Connect over CDP
        browserInstance = await chromium.connectOverCDP(
          `wss://connect.browserbase.com?apiKey=${apiKey}&sessionId=${sessionId}`
        );
        isBrowserbase = true;

        const contexts = browserInstance.contexts();
        if (contexts.length > 0) {
          const pages = contexts[0].pages();
          if (pages.length > 0) {
            page = pages[0];
          }
        }
        if (!page) {
          page = await browserInstance.newPage();
        }
      } else {
        // Fallback: Launch local headless browser
        console.log('Browserbase credentials not set. Falling back to local Playwright launch.');
        browserInstance = await chromium.launch({ headless: true });
        page = await browserInstance.newPage();
      }

      // Set a generic user-agent to bypass basic bot detection
      await page.setExtraHTTPHeaders({
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9'
      });

      // Run scraper based on platform
      switch (platform) {
        case 'amazon':
          return await scrapeAmazon(page, url);
        case 'flipkart':
          return await scrapeFlipkart(page, url);
        case 'meesho':
          return await scrapeMeesho(page, url);
        case 'custom':
        default:
          return await this.scrapeCustom(page, url);
      }
    } catch (err: any) {
      console.error(`Error during scraping of ${url} on ${platform}:`, err);
      throw err;
    } finally {
      // 3. Immediately close browser session
      try {
        if (browserInstance) {
          await browserInstance.close();
        }
      } catch (closeErr) {
        console.error('Failed to close browser instance:', closeErr);
      }
    }
  },

  /**
   * Resilient custom URL scraper
   */
  async scrapeCustom(page: any, url: string): Promise<{
    productName: string;
    price: number | null;
    originalPrice: number | null;
    inStock: boolean;
    imageUrl: string | null;
  }> {
    console.log(`Scraping custom URL: ${url}`);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);

    const title = await page.title().catch(() => 'Custom Product');
    const bodyText = await page.locator('body').innerText().catch(() => '');
    
    // Attempt price regex parse
    let price: number | null = null;
    const match = bodyText.match(/(?:₹|Rs\.?|\$)\s*([0-9,]+(?:\.[0-9]{2})?)/i);
    if (match) {
      const clean = match[1].replace(/[^\d.]/g, '');
      const val = parseFloat(clean);
      if (!isNaN(val)) price = val;
    }

    // Image fallback: find first reasonable image
    let imageUrl = '';
    const images = await page.locator('img').all();
    for (const img of images) {
      const src = await img.getAttribute('src').catch(() => null);
      if (src && src.startsWith('http') && !src.includes('logo') && !src.includes('sprite') && !src.includes('icon')) {
        imageUrl = src;
        break;
      }
    }

    let inStock = true;
    if (
      bodyText.toLowerCase().includes('out of stock') ||
      bodyText.toLowerCase().includes('sold out') ||
      bodyText.toLowerCase().includes('currently unavailable')
    ) {
      inStock = false;
    }

    return {
      productName: title.trim(),
      price,
      originalPrice: price,
      inStock,
      imageUrl: imageUrl || 'https://images.unsplash.com/photo-1523474253046-8cd2748b5fd2?auto=format&fit=crop&w=400&h=400&q=80'
    };
  },

  /**
   * Run a single price check on a price watch
   */
  async checkWatch(watchId: string): Promise<boolean> {
    const supabase = supabaseService.getServiceClient();
    
    // Fetch watch details
    const { data: watch, error: fetchErr } = await supabase
      .from('price_watches')
      .select('*')
      .eq('id', watchId)
      .single();

    if (fetchErr || !watch) {
      console.error(`Could not fetch watch ID ${watchId}:`, fetchErr?.message);
      return false;
    }

    if (watch.status === 'paused' || watch.status === 'expired') {
      console.log(`Watch ${watchId} is ${watch.status}. Skipping price check.`);
      return false;
    }

    try {
      // Scrape product
      const result = await this.scrapeProduct(watch.product_url, watch.platform);
      
      if (result.price === null) {
        console.warn(`Scraped price for watch ${watchId} was null. Skipping update.`);
        // Even if price is null, update last checked time to prevent infinite retries
        await supabase
          .from('price_watches')
          .update({ last_checked_at: new Date().toISOString() })
          .eq('id', watchId);
        return false;
      }

      const currentPrice = result.price;
      const originalPrice = watch.original_price || result.originalPrice || currentPrice;
      const lowestPrice = watch.lowest_price === null 
        ? currentPrice 
        : Math.min(watch.lowest_price, currentPrice);

      // Compute deal score
      const dealScore = originalPrice > 0
        ? Math.max(0, Math.min(100, Math.round(((originalPrice - currentPrice) / originalPrice) * 100)))
        : 0;

      // 1. Update Price Watch Record
      const updateData: any = {
        current_price: currentPrice,
        lowest_price: lowestPrice,
        original_price: originalPrice,
        product_name: result.productName || watch.product_name,
        last_checked_at: new Date().toISOString()
      };

      if (result.imageUrl) {
        updateData.image_url = result.imageUrl; // update image if found
      }

      // Check if price meets target price AND watch status is still 'watching'
      const isTargetHit = currentPrice <= watch.target_price && watch.status === 'watching';
      
      if (isTargetHit) {
        updateData.status = 'triggered';
        updateData.triggered_at = new Date().toISOString();
      }

      const { error: updateErr } = await supabase
        .from('price_watches')
        .update(updateData)
        .eq('id', watchId);

      if (updateErr) {
        console.error(`Failed to update price watch ${watchId}:`, updateErr.message);
      }

      // 2. Insert into price history
      const { error: histErr } = await supabase
        .from('price_history')
        .insert({
          watch_id: watchId,
          price: currentPrice,
          in_stock: result.inStock,
          deal_score: dealScore,
          scraped_at: new Date().toISOString()
        });

      if (histErr) {
        console.error(`Failed to record price history for watch ${watchId}:`, histErr.message);
      }

      // 3. Dispatch Alerts if target hit (Alert only once!)
      if (isTargetHit) {
        console.log(`🎯 TARGET HIT for watch ${watchId}: current ${currentPrice} <= target ${watch.target_price}`);
        
        const watchWithNewData: PriceWatch = {
          ...watch,
          current_price: currentPrice,
          original_price: originalPrice,
          image_url: result.imageUrl || watch.image_url
        };

        // Try both alerts independently so that a failure in one doesn't stop the other
        if (watch.alert_email) {
          try {
            await priceAlertService.sendEmailAlert(watchWithNewData, currentPrice);
          } catch (emailErr) {
            console.error(`Failed to dispatch email alert for watch ${watchId}:`, emailErr);
          }
        }

        if (watch.alert_whatsapp) {
          try {
            await priceAlertService.sendWhatsAppAlert(watchWithNewData, currentPrice);
          } catch (waErr) {
            console.error(`Failed to dispatch WhatsApp alert for watch ${watchId}:`, waErr);
          }
        }
      }

      return true;
    } catch (err: any) {
      console.error(`Failed to check watch ${watchId}:`, err.message || err);
      // Update checked time anyway to mark effort
      await supabase
        .from('price_watches')
        .update({ last_checked_at: new Date().toISOString() })
        .eq('id', watchId);
      return false;
    }
  },

  /**
   * Find and check all due watches
   */
  async checkAllDueWatches(): Promise<number> {
    const supabase = supabaseService.getServiceClient();
    
    // Fetch all active watches
    const { data: watches, error } = await supabase
      .from('price_watches')
      .select('*')
      .eq('status', 'watching');

    if (error || !watches) {
      console.error('Failed to fetch price watches for cron check:', error?.message);
      return 0;
    }

    const now = new Date();
    let triggeredCount = 0;

    for (const watch of watches) {
      // Check interval logic: if never checked, check now.
      // If checked, check if (now - last_checked_at) >= check_interval hours
      let isDue = false;
      if (!watch.last_checked_at) {
        isDue = true;
      } else {
        const lastChecked = new Date(watch.last_checked_at);
        const diffMs = now.getTime() - lastChecked.getTime();
        const diffHours = diffMs / (1000 * 60 * 60);
        // Guarantee checkInterval has a minimum of 1 hour
        const intervalHours = Math.max(1, watch.check_interval || 6);
        if (diffHours >= intervalHours) {
          isDue = true;
        }
      }

      if (isDue) {
        console.log(`Watch ${watch.id} is due for a check. Checking now...`);
        const success = await this.checkWatch(watch.id);
        if (success) triggeredCount++;
      }
    }

    return triggeredCount;
  }
};

export default priceWatchService;
