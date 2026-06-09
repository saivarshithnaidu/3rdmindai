import { NextRequest, NextResponse } from 'next/server';
import supabaseService from '../../../../services/supabase.service';
import procurementService from '../../../../services/procurement.service';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { itemId } = body;

    if (!itemId) {
      return NextResponse.json({ error: 'Missing required field: itemId' }, { status: 400 });
    }

    // Trigger findAlternatives in background via setTimeout
    setTimeout(() => {
      procurementService.findAlternatives(itemId).catch((err) => {
        console.error('Background findAlternatives failed:', err);
      });
    }, 0);

    return NextResponse.json({ success: true, message: 'Finding alternatives...' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const itemId = searchParams.get('itemId');

    if (!itemId) {
      return NextResponse.json({ error: 'Missing itemId query parameter' }, { status: 400 });
    }

    const supabase = supabaseService.getServiceClient();

    const { data: alternatives, error } = await supabase
      .from('procurement_alternatives')
      .select('*')
      .eq('item_id', itemId)
      .order('features_match', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ success: true, alternatives: alternatives || [] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
