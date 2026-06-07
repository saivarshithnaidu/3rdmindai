import supabaseService from './supabase.service';
import { AgentAnalytics } from '../types';

export const analyticsService = {
  async computeWeeklyAnalytics(projectId: string, weekStart: string): Promise<AgentAnalytics[]> {
    const supabase = supabaseService.getServiceClient();
    
    // Parse start and end timestamps for the 7-day week window
    const startDate = new Date(weekStart);
    const endDate = new Date(startDate.getTime() + 7 * 24 * 60 * 60 * 1000);
    const startISO = startDate.toISOString();
    const endISO = endDate.toISOString();

    // 1. Fetch active agents
    const { data: agents } = await supabase
      .from('startup_agents')
      .select('*')
      .eq('project_id', projectId);

    if (!agents || agents.length === 0) {
      return [];
    }

    const computedAnalytics: AgentAnalytics[] = [];

    for (const agent of agents) {
      // 2. Fetch tasks in week range
      const { data: tasks } = await supabase
        .from('agent_tasks')
        .select('*')
        .eq('agent_id', agent.id)
        .eq('project_id', projectId)
        .gte('created_at', startISO)
        .lt('created_at', endISO);

      const tasksList = tasks || [];
      const completedCount = tasksList.filter((t) => t.status === 'done').length;
      const failedCount = tasksList.filter((t) => t.status === 'failed').length;

      // Average score and revision rounds
      let totalJudgeScore = 0;
      let evaluatedTasksCount = 0;
      let totalRevisions = 0;

      tasksList.forEach((t) => {
        if (t.judge_score !== null && t.judge_score !== undefined) {
          totalJudgeScore += t.judge_score;
          evaluatedTasksCount++;
        }
        totalRevisions += t.revision_round || 0;
      });

      const avgJudgeScore = evaluatedTasksCount > 0 ? parseFloat((totalJudgeScore / evaluatedTasksCount).toFixed(1)) : 0;
      const avgRevisionRounds = tasksList.length > 0 ? parseFloat((totalRevisions / tasksList.length).toFixed(1)) : 0;

      // 3. Count emails sent during this week
      const { data: emailCalls } = await supabase
        .from('tool_calls')
        .select('id')
        .eq('agent_id', agent.id)
        .eq('project_id', projectId)
        .eq('tool_name', 'gmail_send')
        .eq('status', 'done')
        .gte('created_at', startISO)
        .lt('created_at', endISO);

      const emailsSent = emailCalls?.length || 0;

      // 4. Count memories created
      const { data: memories } = await supabase
        .from('agent_memory')
        .select('id')
        .eq('agent_id', agent.id)
        .eq('project_id', projectId)
        .gte('created_at', startISO)
        .lt('created_at', endISO);

      const memoriesCreated = memories?.length || 0;

      const recordData: AgentAnalytics = {
        agent_id: agent.id,
        project_id: projectId,
        week_start: weekStart,
        tasks_completed: completedCount,
        tasks_failed: failedCount,
        avg_judge_score: avgJudgeScore,
        avg_revision_rounds: avgRevisionRounds,
        emails_sent: emailsSent,
        memories_created: memoriesCreated
      };

      // 5. Upsert into agent_analytics
      const { error: upsertErr } = await supabase
        .from('agent_analytics')
        .upsert(recordData, {
          onConflict: 'agent_id,project_id,week_start'
        });

      if (upsertErr) {
        console.error(`Failed to upsert weekly analytics for agent ${agent.role} (${agent.name}):`, upsertErr);
      } else {
        computedAnalytics.push(recordData);
      }
    }

    return computedAnalytics;
  },

  async getAgentTrend(agentId: string, projectId: string, weeks: number = 8): Promise<AgentAnalytics[]> {
    const supabase = supabaseService.getClient();
    
    // Fetch last N weekly records
    const { data, error } = await supabase
      .from('agent_analytics')
      .select('*')
      .eq('agent_id', agentId)
      .eq('project_id', projectId)
      .order('week_start', { ascending: true })
      .limit(weeks);

    if (error) {
      console.error(`Failed to retrieve trends for agent ${agentId}:`, error);
      return [];
    }

    return data || [];
  }
};

export default analyticsService;
