import { NextRequest, NextResponse } from 'next/server';
import supabaseService from '../../../../../services/supabase.service';

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const projectId = url.searchParams.get('projectId');

    if (!projectId) {
      return NextResponse.json({ error: 'Missing parameter: projectId' }, { status: 400 });
    }

    const supabase = supabaseService.getServiceClient();
    const { data: monitors, error } = await supabase
      .from('deployment_monitors')
      .select('*')
      .eq('project_id', projectId);

    if (error) throw error;

    const monitorIds = (monitors || []).map((m: any) => m.id);
    let incidents: any[] = [];

    if (monitorIds.length > 0) {
      const { data: incidentRows } = await supabase
        .from('deployment_incidents')
        .select('*')
        .in('monitor_id', monitorIds)
        .order('started_at', { ascending: false });
      
      incidents = incidentRows || [];
    }

    return NextResponse.json({ success: true, monitors, incidents });
  } catch (err: any) {
    console.error('List monitors API failed:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
