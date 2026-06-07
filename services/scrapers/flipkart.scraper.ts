import { Page } from 'playwright';
import { ScrapeResult } from './amazon.scraper';

export async function scrapeFlipkart(page: Page, url: string): Promise<ScrapeResult> {
  console.log(`Scraping Flipkart URL: ${url}`);
  
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2000);

  // Fallback Selector List for Price
  let priceText = '';
  const priceSelectors = [
    '.Nx9b55',          // New Flipkart layout class
    '._30jeq3',         // Common price class
    '._16Jk6d',
    'div.hlbknR',
    'div._30jeq3._16Jk6d',
    '.yCl3nQ'
  ];

  for (const selector of priceSelectors) {
    try {
      const el = page.locator(selector).first();
      if (await el.isVisible()) {
        const text = await el.innerText();
        if (text && text.trim()) {
          priceText = text.trim();
          break;
        }
      }
    } catch (e) {
      // Ignore
    }
  }

  // Fallback Selector List for Original Price
  let originalPriceText = '';
  const originalPriceSelectors = [
    '.yRPvD1',          // New original price layout class
    '._3I9_ca',         // Common original price class
    '.div._3I9_ca',
    'span.strike'
  ];

  for (const selector of originalPriceSelectors) {
    try {
      const el = page.locator(selector).first();
      if (await el.isVisible()) {
        const text = await el.innerText();
        if (text && text.trim()) {
          originalPriceText = text.trim();
          break;
        }
      }
    } catch (e) {
      // Ignore
    }
  }

  // Fallback Selector List for Title
  let title = '';
  const titleSelectors = [
    '.VU-ZEg',          // New title layout class
    '.B_NuCI',          // Common title class
    'h1.title',
    '.yhB1nd span'
  ];

  for (const selector of titleSelectors) {
    try {
      const el = page.locator(selector).first();
      if (await el.isVisible()) {
        const text = await el.innerText();
        if (text && text.trim()) {
          title = text.trim();
          break;
        }
      }
    } catch (e) {
      // Ignore
    }
  }

  // Fallback Selector List for Image
  let imageUrl = '';
  const imgSelectors = [
    '._396cs4',
    '._2r_T1I',
    'img._2r_T1I',
    'img.DByoEF',
    'img.CXW8mj',
    '.q6DClP img'
  ];

  for (const selector of imgSelectors) {
    try {
      const el = page.locator(selector).first();
      if (await el.isVisible()) {
        const src = await el.getAttribute('src');
        if (src && src.startsWith('http')) {
          imageUrl = src;
          break;
        }
      }
    } catch (e) {
      // Ignore
    }
  }

  // Determine availability
  let inStock = true;
  try {
    const outOfStockEl = page.locator('div._1wvB4H, div.Z3D17H').first();
    const outOfStockText = await outOfStockEl.innerText().catch(() => '');
    if (outOfStockText.toLowerCase().includes('sold out') || outOfStockText.toLowerCase().includes('out of stock')) {
      inStock = false;
    }
    
    // Check if there is an "Out of stock" button or text
    const pageBodyText = await page.locator('body').innerText().catch(() => '');
    if (
      pageBodyText.toLowerCase().includes('sold out') || 
      pageBodyText.toLowerCase().includes('this item is currently out of stock')
    ) {
      inStock = false;
    }
  } catch (e) {
    // Ignore
  }

  // Fallback parsing from page title/body
  if (!title) {
    title = await page.title().catch(() => '');
    if (title) {
      title = title.split('|')[0].trim();
    }
  }

  if (!priceText) {
    const pageBodyText = await page.locator('body').innerText().catch(() => '');
    const match = pageBodyText.match(/(?:₹|Rs\.?)\s*([0-9,]+)/i);
    if (match) {
      priceText = match[1];
    }
  }

  if (!imageUrl) {
    const images = await page.locator('img').all();
    for (const img of images) {
      const src = await img.getAttribute('src').catch(() => null);
      if (src && src.includes('rukminim1.flixcart.com/image/') && !src.includes('logo')) {
        imageUrl = src;
        break;
      }
    }
  }

  const parseNum = (val: string): number | null => {
    if (!val) return null;
    const clean = val.replace(/[^\d.]/g, '');
    const num = parseFloat(clean);
    return isNaN(num) ? null : num;
  };

  const finalPrice = parseNum(priceText);
  const finalOriginalPrice = parseNum(originalPriceText) || finalPrice;

  return {
    productName: title || 'Flipkart Product',
    price: finalPrice,
    originalPrice: finalOriginalPrice,
    inStock,
    imageUrl: imageUrl || 'https://images.unsplash.com/photo-1523474253046-8cd2748b5fd2?auto=format&fit=crop&w=400&h=400&q=80'
  };
}
