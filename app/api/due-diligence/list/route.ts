import { NextRequest, NextResponse } from 'next/server';
import supabaseService from '../../../../services/supabase.service';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('projectId');

    if (!projectId) {
      return NextResponse.json({ error: 'Missing projectId parameter' }, { status: 400 });
    }

    const supabase = supabaseService.getServiceClient();

    const { data: reports, error } = await supabase
      .from('dd_reports')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, reports });
  } catch (err: any) {
    console.error('Error listing due diligence reports:', err);
    return NextResponse.json({ error: err.message || String(err) }, { status: 500 });
  }
}
