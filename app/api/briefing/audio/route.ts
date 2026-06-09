import { NextRequest, NextResponse } from 'next/server';
import supabaseService from '../../../../services/supabase.service';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const briefingId = searchParams.get('briefingId');
    const supabase = supabaseService.getServiceClient();

    if (!briefingId) {
      return NextResponse.json({ error: 'Missing briefingId' }, { status: 400 });
    }

    const { data: briefing, error } = await supabase
      .from('voice_briefings')
      .select('id, audio_url, status')
      .eq('id', briefingId)
      .single();

    if (error || !briefing) {
      return NextResponse.json({ error: 'Briefing not found' }, { status: 404 });
    }

    if (!briefing.audio_url) {
      return NextResponse.json({
        success: true,
        audio_url: null,
        message: 'Audio not yet generated for this briefing.',
      });
    }

    return NextResponse.json({
      success: true,
      audio_url: briefing.audio_url,
      status: briefing.status,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
