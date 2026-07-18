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
    const { data: learnings, error } = await supabase
      .from('agent_learnings')
      .select('*')
      .eq('project_id', projectId);

    if (error) throw error;

    return NextResponse.json({ success: true, learnings: learnings || [] });
  } catch (err: any) {
    console.error('Error in GET api/learning/export:', err);
    return NextResponse.json({ error: err.message || String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { projectId, learnings } = await req.json();

    if (!projectId || !Array.isArray(learnings)) {
      return NextResponse.json({ error: 'Missing projectId or learnings array' }, { status: 400 });
    }

    const supabase = supabaseService.getServiceClient();
    let importedCount = 0;

    for (const item of learnings) {
      // Find matching agent by role in this project to map correctly if agent IDs changed
      // (usually when migrating between projects)
      let targetAgentId = item.agent_id;

      // If it's a migration, get the role from the old learning and match it to an agent in the new project
      if (item.startup_agents?.role || item.role) {
        const role = item.startup_agents?.role || item.role;
        const { data: matchingAgent } = await supabase
          .from('startup_agents')
          .select('id')
          .eq('project_id', projectId)
          .eq('role', role)
          .maybeSingle();
        if (matchingAgent) {
          targetAgentId = matchingAgent.id;
        }
      }

      // Check if this learning already exists in the new project
      const { data: existing } = await supabase
        .from('agent_learnings')
        .select('id, confidence')
        .eq('project_id', projectId)
        .eq('agent_id', targetAgentId)
        .eq('insight', item.insight)
        .maybeSingle();

      if (existing) {
        await supabase
          .from('agent_learnings')
          .update({
            confidence: Math.max(existing.confidence || 0.5, item.confidence || 0.5),
            is_active: item.is_active !== undefined ? item.is_active : true,
            last_reinforced: new Date().toISOString()
          })
          .eq('id', existing.id);
      } else {
        await supabase
          .from('agent_learnings')
          .insert({
            project_id: projectId,
            agent_id: targetAgentId,
            learning_type: item.learning_type,
            category: item.category,
            insight: item.insight,
            confidence: item.confidence || 0.5,
            evidence_count: item.evidence_count || 1,
            is_active: item.is_active !== undefined ? item.is_active : true
          });
      }
      importedCount++;
    }

    return NextResponse.json({ success: true, importedCount });
  } catch (err: any) {
    console.error('Error in POST api/learning/export:', err);
    return NextResponse.json({ error: err.message || String(err) }, { status: 500 });
  }
}
