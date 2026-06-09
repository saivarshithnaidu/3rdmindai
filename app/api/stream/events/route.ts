import { NextRequest, NextResponse } from 'next/server';
import supabaseService from '../../../../services/supabase.service';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('projectId');
    const limitParam = searchParams.get('limit') || '50';
    const limit = parseInt(limitParam, 10) || 50;

    if (!projectId) {
      return NextResponse.json({ error: 'Missing projectId parameter' }, { status: 400 });
    }

    const supabase = supabaseService.getServiceClient();
    const { data: events, error } = await supabase
      .from('stream_events')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: true })
      .limit(limit);

    if (error) {
      console.error('Database error fetching stream events:', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const formattedEvents = (events || []).map((row: any) => ({
      id: row.id,
      projectId: row.project_id,
      type: row.event_type,
      title: row.title,
      detail: row.detail,
      agentId: row.agent_id,
      agentName: row.agent_name,
      data: row.data,
      status: row.status,
      timestamp: row.created_at
    }));

    return NextResponse.json({ success: true, events: formattedEvents });
  } catch (err: any) {
    console.error('Error in /api/stream/events GET:', err);
    return NextResponse.json({ error: err.message || String(err) }, { status: 500 });
  }
}
