import { NextRequest, NextResponse } from 'next/server';
import supabaseService from '../../../../services/supabase.service';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const agentId = searchParams.get('agentId');
    const projectId = searchParams.get('projectId');

    if (!agentId || !projectId) {
      return NextResponse.json({ error: 'Missing agentId or projectId' }, { status: 400 });
    }

    const supabase = supabaseService.getClient();

    // 1. Fetch performance trend: last 10 task scores (chronological)
    const { data: trendTasks } = await supabase
      .from('agent_tasks')
      .select('id, title, judge_score, created_at')
      .eq('agent_id', agentId)
      .not('judge_score', 'is', null)
      .order('created_at', { ascending: false })
      .limit(10);

    const trend = (trendTasks || [])
      .map((t: any) => ({
        id: t.id,
        title: t.title,
        score: t.judge_score,
        date: t.created_at
      }))
      .reverse();

    // 2. Fetch active learnings count
    const { count: activeLearningsCount } = await supabase
      .from('agent_learnings')
      .select('id', { count: 'exact', head: true })
      .eq('agent_id', agentId)
      .eq('project_id', projectId)
      .eq('is_active', true);

    // 3. Fetch latest strategy version
    const { data: latestStrategy } = await supabase
      .from('agent_strategy_versions')
      .select('version, strategy_additions')
      .eq('agent_id', agentId)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle();

    const strategyVersion = latestStrategy?.version || 0;

    // 4. Fetch top 3 learnings
    const { data: topLearnings } = await supabase
      .from('agent_learnings')
      .select('*')
      .eq('agent_id', agentId)
      .eq('project_id', projectId)
      .eq('is_active', true)
      .order('confidence', { ascending: false })
      .order('evidence_count', { ascending: false })
      .limit(3);

    // 5. Calculate Improvement Rate: (avg of last 5) - (avg of first 5)
    const { data: allScores } = await supabase
      .from('agent_tasks')
      .select('judge_score')
      .eq('agent_id', agentId)
      .not('judge_score', 'is', null)
      .order('created_at', { ascending: true });

    let improvementRate = 0;
    if (allScores && allScores.length >= 5) {
      const first5 = allScores.slice(0, 5).map((s: any) => s.judge_score || 0);
      const last5 = allScores.slice(-5).map((s: any) => s.judge_score || 0);
      const avgFirst = first5.reduce((a: number, b: number) => a + b, 0) / 5;
      const avgLast = last5.reduce((a: number, b: number) => a + b, 0) / 5;
      improvementRate = parseFloat((avgLast - avgFirst).toFixed(1));
    }

    // 6. Fetch total tasks count
    const { count: totalTasksCount } = await supabase
      .from('agent_tasks')
      .select('id', { count: 'exact', head: true })
      .eq('agent_id', agentId)
      .eq('status', 'done');

    return NextResponse.json({
      success: true,
      trend,
      activeLearningsCount: activeLearningsCount || 0,
      strategyVersion,
      topLearnings: topLearnings || [],
      improvementRate,
      totalTasks: totalTasksCount || 0
    });
  } catch (err: any) {
    console.error('Error in api/learning/analytics:', err);
    return NextResponse.json({ error: err.message || String(err) }, { status: 500 });
  }
}
