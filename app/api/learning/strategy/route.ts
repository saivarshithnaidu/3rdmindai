import { NextRequest, NextResponse } from 'next/server';
import supabaseService from '../../../../services/supabase.service';
import learningService from '../../../../services/learning.service';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const agentId = searchParams.get('agentId');

    if (!agentId) {
      return NextResponse.json({ error: 'Missing agentId' }, { status: 400 });
    }

    const supabase = supabaseService.getClient();
    const { data: versions, error } = await supabase
      .from('agent_strategy_versions')
      .select('*')
      .eq('agent_id', agentId)
      .order('version', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ success: true, versions: versions || [] });
  } catch (err: any) {
    console.error('Error in GET api/learning/strategy:', err);
    return NextResponse.json({ error: err.message || String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { agentId, projectId } = await req.json();

    if (!agentId || !projectId) {
      return NextResponse.json({ error: 'Missing agentId or projectId' }, { status: 400 });
    }

    const strategy = await learningService.updateAgentStrategy(agentId, projectId);

    return NextResponse.json({ success: true, strategy });
  } catch (err: any) {
    console.error('Error in POST api/learning/strategy:', err);
    return NextResponse.json({ error: err.message || String(err) }, { status: 500 });
  }
}
