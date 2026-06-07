import { NextRequest, NextResponse } from 'next/server';
import supabaseService from '../../../../services/supabase.service';
import priceWatchService from '../../../../services/price-watch.service';

export async function POST(req: NextRequest) {
  try {
    const {
      projectId,
      productName,
      productUrl,
      platform,
      targetPrice,
      checkInterval,
      alertEmail,
      alertWhatsapp,
      userId
    } = await req.json();

    if (!productName || !productUrl || !platform || targetPrice === undefined) {
      return NextResponse.json({ error: 'Missing required fields: productName, productUrl, platform, targetPrice' }, { status: 400 });
    }

    const finalUserId = userId || '00000000-0000-0000-0000-000000000000'; // Default system/fallback UUID

    const supabase = supabaseService.getServiceClient();
    const { data: watch, error } = await supabase
      .from('price_watches')
      .insert({
        project_id: projectId || null,
        user_id: finalUserId,
        product_name: productName,
        product_url: productUrl,
        platform,
        target_price: Number(targetPrice),
        check_interval: Number(checkInterval || 6),
        alert_email: alertEmail || null,
        alert_whatsapp: alertWhatsapp || null,
        status: 'watching'
      })
      .select()
      .single();

    if (error) {
      console.error('Database error in price watch create:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Trigger initial scrape asynchronously
    priceWatchService.checkWatch(watch.id).catch((err) => {
      console.error(`Initial price check failed for watch ${watch.id}:`, err);
    });

    return NextResponse.json({ success: true, watch });
  } catch (error: any) {
    console.error('Error in /api/price-watch/create:', error);
    return NextResponse.json({ error: error.message || String(error) }, { status: 500 });
  }
}
