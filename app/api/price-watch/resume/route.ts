import { NextRequest, NextResponse } from 'next/server';
import supabaseService from '../../../../services/supabase.service';

export async function POST(req: NextRequest) {
  try {
    const { watchId } = await req.json();

    if (!watchId) {
      return NextResponse.json({ error: 'Missing watchId' }, { status: 400 });
    }

    const supabase = supabaseService.getServiceClient();
    const { data: watch, error } = await supabase
      .from('price_watches')
      .update({ status: 'watching' })
      .eq('id', watchId)
      .select()
      .single();

    if (error) {
      console.error('Database error in price watch resume:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, watch });
  } catch (error: any) {
    console.error('Error in /api/price-watch/resume:', error);
    return NextResponse.json({ error: error.message || String(error) }, { status: 500 });
  }
}
