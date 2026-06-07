import { NextRequest, NextResponse } from 'next/server';
import supabaseService from '../../../../services/supabase.service';

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const projectId = url.searchParams.get('projectId');

    if (!projectId) {
      return NextResponse.json({ error: 'Missing projectId' }, { status: 400 });
    }

    const supabase = supabaseService.getServiceClient();
    const { data: sessions, error } = await supabase
      .from('browser_sessions')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json(sessions || []);
  } catch (err: any) {
    console.error('Error fetching browser sessions:', err);
    return NextResponse.json({ error: err.message || String(err) }, { status: 500 });
  }
}
