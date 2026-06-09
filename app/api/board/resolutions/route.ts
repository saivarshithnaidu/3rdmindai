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
    const { data: resolutions, error } = await supabase
      .from('board_resolutions')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return NextResponse.json({ success: true, resolutions });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { resolutionId, status } = await req.json();
    if (!resolutionId || !status) {
      return NextResponse.json({ error: 'Missing resolutionId or status' }, { status: 400 });
    }
    const supabase = supabaseService.getServiceClient();
    const { data: resolution, error } = await supabase
      .from('board_resolutions')
      .update({ status })
      .eq('id', resolutionId)
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json({ success: true, resolution });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
