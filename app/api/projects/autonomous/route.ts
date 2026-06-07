import { NextRequest, NextResponse } from 'next/server';
import supabaseService from '../../../../services/supabase.service';

export async function PATCH(req: NextRequest) {
  try {
    const { projectId, autonomousMode, autonomousLevel } = await req.json();
    if (!projectId) {
      return NextResponse.json({ error: 'Missing projectId' }, { status: 400 });
    }

    const supabase = supabaseService.getServiceClient();
    const { data: project, error } = await supabase
      .from('projects')
      .update({
        autonomous_mode: autonomousMode,
        autonomous_level: autonomousLevel
      })
      .eq('id', projectId)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({ project });
  } catch (err: any) {
    console.error('Error in projects autonomous PATCH route:', err);
    return NextResponse.json({ error: err.message || String(err) }, { status: 500 });
  }
}
