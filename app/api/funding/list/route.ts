import { NextRequest, NextResponse } from 'next/server';
import supabaseService from '../../../../services/supabase.service';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('projectId');
    if (!projectId) {
      return NextResponse.json({ error: 'Missing projectId' }, { status: 400 });
    }

    const supabase = supabaseService.getServiceClient();
    const { data: matches, error } = await supabase
      .from('funding_matches')
      .select('*, funding_opportunities(*)')
      .eq('project_id', projectId)
      .order('match_score', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ success: true, matches: matches || [] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
