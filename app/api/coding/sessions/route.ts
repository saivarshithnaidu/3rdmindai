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
    const { data: sessions, error } = await supabase
      .from('coding_sessions')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ success: true, sessions: sessions || [] });
  } catch (err: any) {
    console.error('List sessions API route failed:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
