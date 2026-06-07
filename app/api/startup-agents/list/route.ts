import { NextRequest, NextResponse } from 'next/server';
import supabaseService from '../../../../services/supabase.service';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('projectId');

    if (!projectId) {
      return NextResponse.json({ error: 'Missing projectId' }, { status: 400 });
    }

    const supabase = supabaseService.getClient();

    // 1. Fetch agents
    const { data: agents, error: fetchErr } = await supabase
      .from('startup_agents')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: true });

    if (fetchErr) {
      throw fetchErr;
    }

    if (!agents || agents.length === 0) {
      return NextResponse.json({ agents: [] });
    }

    // 2. Enrich each agent with memory count and latest task
    const enrichedAgents = await Promise.all(
      agents.map(async (agent) => {
        // Get memory count
        const { count: memoryCount, error: memErr } = await supabase
          .from('agent_memory')
          .select('id', { count: 'exact', head: true })
          .eq('agent_id', agent.id);

        // Get latest task
        const { data: lastTask } = await supabase
          .from('agent_tasks')
          .select('title, status, created_at')
          .eq('agent_id', agent.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        return {
          ...agent,
          memory_count: memoryCount || 0,
          latest_task: lastTask || null,
        };
      })
    );

    return NextResponse.json({ agents: enrichedAgents });
  } catch (err: any) {
    console.error('Error in startup-agents list route:', err);
    return NextResponse.json(
      { error: err.message || String(err) },
      { status: 500 }
    );
  }
}
