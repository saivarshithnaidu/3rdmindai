import { NextRequest, NextResponse } from 'next/server';
import priceWatchService from '../../../../services/price-watch.service';
import supabaseService from '../../../../services/supabase.service';

export async function POST(req: NextRequest) {
  try {
    const { watchId } = await req.json();

    if (!watchId) {
      return NextResponse.json({ error: 'Missing watchId' }, { status: 400 });
    }

    const success = await priceWatchService.checkWatch(watchId);
    if (!success) {
      return NextResponse.json({ error: 'Failed to complete price watch check' }, { status: 500 });
    }

    const supabase = supabaseService.getServiceClient();
    const { data: watch } = await supabase
      .from('price_watches')
      .select('*')
      .eq('id', watchId)
      .single();

    return NextResponse.json({ success: true, watch });
  } catch (error: any) {
    console.error('Error in /api/price-watch/check:', error);
    return NextResponse.json({ error: error.message || String(error) }, { status: 500 });
  }
}
