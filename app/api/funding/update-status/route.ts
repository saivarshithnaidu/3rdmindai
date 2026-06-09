import { NextRequest, NextResponse } from 'next/server';
import supabaseService from '../../../../services/supabase.service';

export async function POST(req: NextRequest) {
  try {
    const { matchId, status } = await req.json();
    if (!matchId || !status) {
      return NextResponse.json({ error: 'Missing matchId or status' }, { status: 400 });
    }

    const supabase = supabaseService.getServiceClient();
    const { data: match, error } = await supabase
      .from('funding_matches')
      .update({ status })
      .eq('id', matchId)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, match });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
