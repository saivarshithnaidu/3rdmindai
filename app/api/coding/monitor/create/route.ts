import { NextRequest, NextResponse } from 'next/server';
import supabaseService from '../../../../../services/supabase.service';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { sessionId, deployedUrl, platform } = body;

    if (!sessionId || !deployedUrl || !platform) {
      return NextResponse.json({ error: 'Missing parameters: sessionId, deployedUrl, platform' }, { status: 400 });
    }

    const supabase = supabaseService.getServiceClient();
    
    // Fetch project_id from session
    const { data: session } = await supabase
      .from('coding_sessions')
      .select('project_id')
      .eq('id', sessionId)
      .single();

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const { data: monitor, error } = await supabase
      .from('deployment_monitors')
      .insert({
        session_id: sessionId,
        project_id: session.project_id,
        deployed_url: deployedUrl,
        platform,
        is_active: true
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, monitor });
  } catch (err: any) {
    console.error('Create monitor API failed:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
