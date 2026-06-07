import { Page } from 'playwright';
import { ScrapeResult } from './amazon.scraper';

export async function scrapeMeesho(page: Page, url: string): Promise<ScrapeResult> {
  console.log(`Scraping Meesho URL: ${url}`);
  
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2000);

  // Fallback Selector List for Price
  let priceText = '';
  try {
    // Meesho pages typically have the price in a large font (e.g. h3 or h4 with "₹" in text)
    const elements = await page.locator('h3, h4, p, span').all();
    for (const el of elements) {
      if (await el.isVisible()) {
        const text = await el.innerText().catch(() => '');
        if (text && text.includes('₹') && text.trim().length < 15) {
          // Verify it matches a price pattern, e.g. ₹299 or ₹ 299
          if (/₹\s*\d+/.test(text)) {
            priceText = text.trim();
            break;
          }
        }
      }
    }
  } catch (e) {
    // Ignore
  }

  // Fallback Selector List for Original Price (often struck through or near discount)
  let originalPriceText = '';
  try {
    const textWithStrike = await page.locator('span[style*="line-through"], p[style*="line-through"]').first().innerText().catch(() => '');
    if (textWithStrike && textWithStrike.trim()) {
      originalPriceText = textWithStrike.trim();
    }
  } catch (e) {
    // Ignore
  }

  // Fallback Selector List for Title
  let title = '';
  const titleSelectors = [
    'h1',
    'span.ProductName__StyledProductName-sc-',
    '.product-name',
    'p.ProductDescription__StyledProductName-sc-'
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
  try {
    // Meesho typically uses high res product images, let's find the main image
    const images = await page.locator('img').all();
    for (const img of images) {
      const src = await img.getAttribute('src').catch(() => null);
      const alt = (await img.getAttribute('alt').catch(() => '')) || '';
      if (src && src.startsWith('http') && (src.includes('images.meesho.com') || alt.toLowerCase().includes(title.toLowerCase().substring(0, 10)))) {
        imageUrl = src;
        break;
      }
    }
  } catch (e) {
    // Ignore
  }

  // Determine availability
  let inStock = true;
  try {
    const pageBodyText = await page.locator('body').innerText().catch(() => '');
    if (
      pageBodyText.toLowerCase().includes('out of stock') ||
      pageBodyText.toLowerCase().includes('sold out') ||
      pageBodyText.toLowerCase().includes('currently unavailable')
    ) {
      inStock = false;
    }
  } catch (e) {
    // Ignore
  }

  // Final parsing from title/page content
  if (!title) {
    title = await page.title().catch(() => '');
    if (title) {
      title = title.split(' - ')[0].trim();
    }
  }

  if (!priceText) {
    const pageBodyText = await page.locator('body').innerText().catch(() => '');
    const match = pageBodyText.match(/(?:₹|Rs\.?)\s*([0-9,]+)/i);
    if (match) {
      priceText = match[1];
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
    productName: title || 'Meesho Product',
    price: finalPrice,
    originalPrice: finalOriginalPrice,
    inStock,
    imageUrl: imageUrl || 'https://images.unsplash.com/photo-1523474253046-8cd2748b5fd2?auto=format&fit=crop&w=400&h=400&q=80'
  };
}
