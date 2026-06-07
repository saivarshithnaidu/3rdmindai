import { Page } from 'playwright';

export interface ScrapeResult {
  productName: string;
  price: number | null;
  originalPrice: number | null;
  inStock: boolean;
  imageUrl: string | null;
}

export async function scrapeAmazon(page: Page, url: string): Promise<ScrapeResult> {
  console.log(`Scraping Amazon India URL: ${url}`);
  
  // Navigate with a reasonable timeout and wait state
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  
  // Wait a moment for dynamic price elements to settle
  await page.waitForTimeout(2000);

  // Fallback Selector List for Price
  let priceText = '';
  const priceSelectors = [
    '.a-price-whole',
    '.a-price .a-offscreen',
    '#priceblock_ourprice',
    '#priceblock_dealprice',
    '.a-color-price',
    'span.apexPriceToPay span.a-offscreen',
    '.priceToPay'
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
      // Ignore and try next
    }
  }

  // Fallback Selector List for Original Price
  let originalPriceText = '';
  const originalPriceSelectors = [
    '.a-text-price .a-offscreen',
    '#priceblock_value',
    '.basisPrice .a-offscreen',
    'span.a-price.a-text-price span.a-offscreen'
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
    '#productTitle',
    'h1.a-size-large',
    'span#productTitle',
    '#title'
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
    '#landingImage',
    '#imgBlkFront',
    '#main-image',
    '#main-image-container img',
    '.a-dynamic-image'
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
        const dataSrc = await el.getAttribute('data-old-hires');
        if (dataSrc && dataSrc.startsWith('http')) {
          imageUrl = dataSrc;
          break;
        }
        const dataA2z = await el.getAttribute('data-a-dynamic-image');
        if (dataA2z) {
          try {
            const urls = Object.keys(JSON.parse(dataA2z));
            if (urls.length > 0) {
              imageUrl = urls[urls.length - 1]; // pick highest resolution
              break;
            }
          } catch (jsonErr) {
            // Ignore
          }
        }
      }
    } catch (e) {
      // Ignore
    }
  }

  // Determine availability
  let inStock = true;
  try {
    const availabilityText = await page.locator('#availability').innerText().catch(() => '');
    if (
      availabilityText.toLowerCase().includes('currently unavailable') ||
      availabilityText.toLowerCase().includes('out of stock') ||
      availabilityText.toLowerCase().includes('sold out')
    ) {
      inStock = false;
    }
  } catch (e) {
    // Ignore
  }

  // General Page Content Regex Parsing as ultimate fallback
  const pageBodyText = await page.locator('body').innerText().catch(() => '');
  
  if (!title) {
    title = await page.title().catch(() => '');
    if (title) {
      title = title.replace('Buy ', '').replace(' Online at Low Prices in India - Amazon.in', '').trim();
    }
  }

  if (!priceText) {
    // Look for prices in the body text (e.g. ₹ 999.00 or Rs. 999)
    const match = pageBodyText.match(/(?:₹|Rs\.?)\s*([0-9,]+(?:\.[0-9]{2})?)/i);
    if (match) {
      priceText = match[1];
    }
  }

  if (!imageUrl) {
    // Find any image on page containing "media" or "images-amazon" or product-like images
    const images = await page.locator('img').all();
    for (const img of images) {
      const src = await img.getAttribute('src').catch(() => null);
      if (src && src.includes('images-amazon.com/images/I/') && !src.includes('sprite') && !src.includes('logo')) {
        imageUrl = src;
        break;
      }
    }
  }

  // Parse price numbers
  const parseNum = (val: string): number | null => {
    if (!val) return null;
    const clean = val.replace(/[^\d.]/g, '');
    const num = parseFloat(clean);
    return isNaN(num) ? null : num;
  };

  const finalPrice = parseNum(priceText);
  const finalOriginalPrice = parseNum(originalPriceText) || finalPrice;

  return {
    productName: title || 'Amazon Product',
    price: finalPrice,
    originalPrice: finalOriginalPrice,
    inStock,
    imageUrl: imageUrl || 'https://images.unsplash.com/photo-1523474253046-8cd2748b5fd2?auto=format&fit=crop&w=400&h=400&q=80'
  };
}
