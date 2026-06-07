import { NextRequest, NextResponse } from 'next/server';
import supabaseService from '../../../../services/supabase.service';
import priceAlertService from '../../../../services/price-alert.service';

export async function POST(req: NextRequest) {
  try {
    const { watchId } = await req.json();

    if (!watchId) {
      return NextResponse.json({ error: 'Missing watchId' }, { status: 400 });
    }

    const supabase = supabaseService.getServiceClient();
    const { data: watch, error: fetchErr } = await supabase
      .from('price_watches')
      .select('*')
      .eq('id', watchId)
      .single();

    if (fetchErr || !watch) {
      return NextResponse.json({ error: fetchErr ? fetchErr.message : 'Watch not found' }, { status: 404 });
    }

    const testPrice = watch.current_price || watch.target_price;
    const emailResult = watch.alert_email 
      ? await priceAlertService.sendEmailAlert(watch, testPrice)
      : { success: false, message: 'Email address not configured.' };

    const whatsappResult = watch.alert_whatsapp
      ? await priceAlertService.sendWhatsAppAlert(watch, testPrice)
      : { success: false, message: 'WhatsApp number not configured.' };

    return NextResponse.json({
      success: true,
      emailResult,
      whatsappResult
    });
  } catch (error: any) {
    console.error('Error in /api/price-watch/test-alert:', error);
    return NextResponse.json({ error: error.message || String(error) }, { status: 500 });
  }
}
