import { NextRequest, NextResponse } from 'next/server';
import supabaseService from '../../../../services/supabase.service';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const watchId = searchParams.get('watchId');

    if (!watchId) {
      return NextResponse.json({ error: 'Missing watchId parameter' }, { status: 400 });
    }

    const supabase = supabaseService.getServiceClient();
    const { data: history, error } = await supabase
      .from('price_history')
      .select('*')
      .eq('watch_id', watchId)
      .order('scraped_at', { ascending: true });

    if (error) {
      console.error('Database error in price watch history:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, history });
  } catch (error: any) {
    console.error('Error in /api/price-watch/history:', error);
    return NextResponse.json({ error: error.message || String(error) }, { status: 500 });
  }
}
