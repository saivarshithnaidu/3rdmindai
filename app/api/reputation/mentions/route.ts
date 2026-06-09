import { NextRequest, NextResponse } from 'next/server';
import supabaseService from '../../../../services/supabase.service';
import reputationService from '../../../../services/reputation.service';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const monitorId = searchParams.get('monitorId');
    if (!monitorId) {
      return NextResponse.json({ error: 'Missing monitorId' }, { status: 400 });
    }
    const supabase = supabaseService.getServiceClient();
    const { data: mentions, error } = await supabase
      .from('brand_mentions')
      .select('*')
      .eq('monitor_id', monitorId)
      .order('found_at', { ascending: false });
    if (error) throw error;
    return NextResponse.json({ success: true, mentions });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { monitorId } = await req.json();
    if (!monitorId) {
      return NextResponse.json({ error: 'Missing monitorId' }, { status: 400 });
    }

    // Trigger asynchronously in background
    setTimeout(async () => {
      try {
        await reputationService.scanMentions(monitorId);
      } catch (err) {
        console.error('Background reputation scan failed:', err);
      }
    }, 100);

    return NextResponse.json({ success: true, message: 'Scan started in background' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
