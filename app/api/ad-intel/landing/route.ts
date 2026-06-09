import { NextRequest, NextResponse } from 'next/server';
import adGeneratorService from '../../../../services/ad-generator.service';
import supabaseService from '../../../../services/supabase.service';

export async function POST(req: NextRequest) {
  try {
    const { reportId, projectId } = await req.json();

    if (!reportId || !projectId) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    const supabase = supabaseService.getServiceClient();
    const { data: report, error: reportErr } = await supabase
      .from('ad_intelligence_reports')
      .select('*')
      .eq('id', reportId)
      .single();

    if (reportErr || !report) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 });
    }

    const landingPageCopy = await adGeneratorService.generateLandingPageCopy(report, projectId);
    return NextResponse.json({ success: true, landingPageCopy });
  } catch (error: any) {
    console.error('Error in /api/ad-intel/landing:', error);
    return NextResponse.json({ error: error.message || String(error) }, { status: 500 });
  }
}
