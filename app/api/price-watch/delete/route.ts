import { NextRequest, NextResponse } from 'next/server';
import supabaseService from '../../../../services/supabase.service';

export async function POST(req: NextRequest) {
  try {
    const { watchId } = await req.json();

    if (!watchId) {
      return NextResponse.json({ error: 'Missing watchId' }, { status: 400 });
    }

    const supabase = supabaseService.getServiceClient();
    const { error } = await supabase
      .from('price_watches')
      .delete()
      .eq('id', watchId);

    if (error) {
      console.error('Database error in price watch delete:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error in /api/price-watch/delete:', error);
    return NextResponse.json({ error: error.message || String(error) }, { status: 500 });
  }
}
