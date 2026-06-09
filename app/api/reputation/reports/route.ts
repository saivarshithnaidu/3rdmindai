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
    const { data: reports, error } = await supabase
      .from('reputation_reports')
      .select('*')
      .eq('monitor_id', monitorId)
      .order('week_start', { ascending: false });
    if (error) throw error;
    return NextResponse.json({ success: true, reports });
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
    const reportId = await reputationService.generateWeeklyReport(monitorId);
    return NextResponse.json({ success: true, reportId });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
