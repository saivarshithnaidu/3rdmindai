import { NextRequest, NextResponse } from 'next/server';
import supabaseService from '../../../../services/supabase.service';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const reportId = searchParams.get('reportId');

    if (!reportId) {
      return NextResponse.json({ error: 'Missing reportId parameter' }, { status: 400 });
    }

    const supabase = supabaseService.getServiceClient();

    // Fetch report details
    const { data: report, error: reportErr } = await supabase
      .from('dd_reports')
      .select('*')
      .eq('id', reportId)
      .single();

    if (reportErr || !report) {
      return NextResponse.json({ error: reportErr?.message || 'Report not found' }, { status: 404 });
    }

    // Fetch sections
    const { data: sections, error: sectionsErr } = await supabase
      .from('dd_sections')
      .select('*')
      .eq('report_id', reportId)
      .order('created_at', { ascending: true });

    if (sectionsErr) {
      return NextResponse.json({ error: sectionsErr.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, report, sections });
  } catch (err: any) {
    console.error('Error fetching due diligence report:', err);
    return NextResponse.json({ error: err.message || String(err) }, { status: 500 });
  }
}
