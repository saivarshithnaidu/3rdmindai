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

    const { data: report, error } = await supabase
      .from('dd_reports')
      .select('pdf_url')
      .eq('id', reportId)
      .single();

    if (error || !report) {
      return NextResponse.json({ error: error?.message || 'Report not found' }, { status: 404 });
    }

    if (!report.pdf_url) {
      return NextResponse.json({ error: 'PDF not generated yet' }, { status: 400 });
    }

    return NextResponse.redirect(report.pdf_url);
  } catch (err: any) {
    console.error('Error fetching due diligence report PDF:', err);
    return NextResponse.json({ error: err.message || String(err) }, { status: 500 });
  }
}
