import { NextRequest, NextResponse } from 'next/server';
import supabaseService from '../../../services/supabase.service';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('projectId');
    const agentId = searchParams.get('agentId');
    const messageId = searchParams.get('messageId');

    if (!projectId) {
      return NextResponse.json({ error: 'Missing projectId' }, { status: 400 });
    }

    const supabase = supabaseService.getServiceClient();
    let query = supabase
      .from('tool_calls')
      .select('*')
      .eq('project_id', projectId);

    if (agentId) {
      query = query.eq('agent_id', agentId);
    }
    if (messageId) {
      query = query.eq('message_id', messageId);
    }

    // Sort by created_at ascending to show execution sequence correctly
    query = query.order('created_at', { ascending: true });

    const { data, error } = await query;

    if (error) throw error;

    return NextResponse.json(data || []);
  } catch (error) {
    console.error('Error fetching tool calls:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
