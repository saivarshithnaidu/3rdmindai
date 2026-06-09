import { NextRequest, NextResponse } from 'next/server';
import supabaseService from '../../../../services/supabase.service';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const competitorId = searchParams.get('competitorId');

    if (!competitorId) {
      return NextResponse.json({ error: 'Missing competitorId parameter' }, { status: 400 });
    }

    const supabase = supabaseService.getServiceClient();
    
    // 1. Fetch latest report
    const { data: report, error: reportErr } = await supabase
      .from('ad_intelligence_reports')
      .select('*')
      .eq('competitor_id', competitorId)
      .order('generated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (reportErr) {
      return NextResponse.json({ error: reportErr.message }, { status: 500 });
    }

    // 2. Fetch all ads for this competitor
    const { data: ads, error: adsErr } = await supabase
      .from('competitor_ads')
      .select('*')
      .eq('competitor_id', competitorId)
      .order('start_date', { ascending: false });

    if (adsErr) {
      return NextResponse.json({ error: adsErr.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, report, ads });
  } catch (error: any) {
    console.error('Error in /api/ad-intel/report:', error);
    return NextResponse.json({ error: error.message || String(error) }, { status: 500 });
  }
}
