import { NextRequest, NextResponse } from 'next/server';
import supabaseService from '../../../../services/supabase.service';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('projectId');
    const supabase = supabaseService.getServiceClient();

    if (!projectId) {
      return NextResponse.json({ error: 'Missing projectId' }, { status: 400 });
    }

    const { data: briefings, error } = await supabase
      .from('voice_briefings')
      .select('*')
      .eq('project_id', projectId)
      .order('briefing_date', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ success: true, briefings: briefings || [] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
