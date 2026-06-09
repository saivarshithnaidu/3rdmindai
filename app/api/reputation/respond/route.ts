import { NextRequest, NextResponse } from 'next/server';
import supabaseService from '../../../../services/supabase.service';

export async function POST(req: NextRequest) {
  try {
    const { mentionId, responseText } = await req.json();
    if (!mentionId || !responseText) {
      return NextResponse.json({ error: 'Missing mentionId or responseText' }, { status: 400 });
    }
    const supabase = supabaseService.getServiceClient();
    const { data: mention, error } = await supabase
      .from('brand_mentions')
      .update({
        response_draft: responseText,
        response_sent: true
      })
      .eq('id', mentionId)
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json({ success: true, mention });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
