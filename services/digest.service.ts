import supabaseService from './supabase.service';
import mcpService from './mcp.service';

export const digestService = {
  async generateWeeklyDigest(runId: string, projectId: string): Promise<string> {
    const supabase = supabaseService.getServiceClient();

    // 1. Fetch autonomous run details
    const { data: run, error: runErr } = await supabase
      .from('autonomous_runs')
      .select('*')
      .eq('id', runId)
      .single();

    if (runErr || !run) {
      throw new Error(`Autonomous run not found: ${runErr?.message}`);
    }

    // 2. Fetch project context
    const { data: project } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .single();

    const projectName = project?.name || 'Your Startup';

    // 3. Fetch all active agents
    const { data: agents } = await supabase
      .from('startup_agents')
      .select('*')
      .eq('project_id', projectId);

    const agentMap = new Map<string, any>();
    if (agents) {
      agents.forEach((a) => agentMap.set(a.id, a));
    }

    // 4. Fetch all tasks triggered during this run
    const { data: tasks } = await supabase
      .from('agent_tasks')
      .select('*')
      .eq('project_id', projectId)
      .eq('triggered_by', 'schedule')
      .gte('created_at', run.created_at)
      .order('completed_at', { ascending: false });

    // Calculate quality averages
    let totalScoreSum = 0;
    let scoredTasksCount = 0;
    let bestAgentName = 'N/A';
    let bestAgentScore = -1;
    let worstAgentName = 'N/A';
    let worstAgentScore = 100;

    const agentStats: Record<string, { count: number; totalScore: number; bestOutput: string }> = {};

    if (tasks) {
      tasks.forEach((t) => {
        const agentObj = agentMap.get(t.agent_id);
        if (!agentObj) return;

        const role = agentObj.role;
        const name = agentObj.name;
        const key = `${role.toUpperCase()} — ${name}`;

        if (!agentStats[key]) {
          agentStats[key] = { count: 0, totalScore: 0, bestOutput: '' };
        }

        agentStats[key].count++;
        if (t.judge_score !== null && t.judge_score !== undefined) {
          const score = t.judge_score;
          agentStats[key].totalScore += score;
          totalScoreSum += score;
          scoredTasksCount++;

          if (score > bestAgentScore) {
            bestAgentScore = score;
            bestAgentName = key;
          }
          if (score < worstAgentScore) {
            worstAgentScore = score;
            worstAgentName = key;
          }
        }

        if (t.output && (!agentStats[key].bestOutput || (t.judge_score || 0) > 35)) {
          agentStats[key].bestOutput = t.output.slice(0, 300) + (t.output.length > 300 ? '...' : '');
        }
      });
    }

    const overallAvgScore = scoredTasksCount > 0 ? Math.round(totalScoreSum / scoredTasksCount) : 0;

    // 5. Build weekly digest markdown content
    let content = `# 3RDMIND Weekly Accomplishments Digest\n`;
    content += `**Project:** ${projectName} | **Week of:** ${run.week_start}\n\n`;
    
    content += `## 🚀 What Your Team Accomplished\n`;
    content += `${run.summary || 'Weekly orchestration complete. Agents executed tasks successfully.'}\n\n`;

    content += `## 👥 Agent Outcomes & Performance\n\n`;
    
    for (const [key, stat] of Object.entries(agentStats)) {
      const avgScore = stat.count > 0 && scoredTasksCount > 0 ? Math.round(stat.totalScore / stat.count) : 0;
      content += `### ${key}\n`;
      content += `- **Tasks Completed:** ${stat.count}\n`;
      content += `- **Average Quality Score:** ${avgScore > 0 ? `${avgScore}/50` : 'Not evaluated'}\n`;
      content += `- **Key Output Preview:**\n> ${stat.bestOutput || 'No output preview available.'}\n\n`;
    }

    content += `## 📊 Quality Performance Overview\n`;
    content += `- **Overall Task Average Score:** ${overallAvgScore}/50\n`;
    content += `- **Highest Performing Agent:** ${bestAgentName} (${bestAgentScore > -1 ? `${bestAgentScore}/50` : 'N/A'})\n`;
    content += `- **Needs Quality Refinement:** ${worstAgentName} (${worstAgentScore < 100 ? `${worstAgentScore}/50` : 'N/A'})\n\n`;

    content += `## 📅 Next Week Focus Areas\n`;
    const ceoAgent = agents?.find((a) => a.role === 'ceo');
    if (ceoAgent) {
      content += `The CEO (${ceoAgent.name}) will align coordinates, define product priorities, and route action tasks to the CMO, CTO, CFO, CRO, and CSO agents next Monday morning.\n`;
    } else {
      content += `Priorities setting will trigger at the start of the next weekly cycle.\n`;
    }

    // Save weekly digest record
    const { data: digestRecord, error: digestErr } = await supabase
      .from('weekly_digests')
      .insert({
        project_id: projectId,
        run_id: runId,
        week_start: run.week_start,
        content,
        sent_to_email: false
      })
      .select()
      .single();

    if (digestErr || !digestRecord) {
      console.error('Failed to save weekly digest record:', digestErr);
    } else {
      try {
        const { default: webhookService } = await import('./webhook.service');
        webhookService.fireWebhook(projectId, 'weekly.digest.ready', digestRecord);
      } catch (webhookErr) {
        console.error('Failed to trigger weekly.digest.ready webhook:', webhookErr);
      }
    }

    // 6. Check for active Gmail connector and dispatch email
    const { data: gmailConn } = await supabase
      .from('connectors')
      .select('*')
      .eq('slug', 'gmail')
      .eq('is_active', true)
      .maybeSingle();

    if (gmailConn && digestRecord) {
      try {
        // Fetch project owner's user ID / email
        const userEmail = project?.user_id ? 'founder@3rdmind.ai' : 'founder@3rdmind.ai'; // Default fallback, we can read user profile
        
        await mcpService.callTool(
          'gmail',
          'gmail_send',
          {
            to: userEmail,
            subject: `3RDMIND: Weekly Accomplishments Digest - Week of ${run.week_start}`,
            body: content
          },
          null,
          projectId,
          null,
          gmailConn.user_id
        );

        // Update send status
        await supabase
          .from('weekly_digests')
          .update({ sent_to_email: true })
          .eq('id', digestRecord.id);

      } catch (mailErr) {
        console.error('Failed to send digest via Gmail connector:', mailErr);
      }
    }

    return content;
  },

  async getWeeklyDigests(projectId: string): Promise<any[]> {
    const supabase = supabaseService.getClient();
    const { data, error } = await supabase
      .from('weekly_digests')
      .select('*')
      .eq('project_id', projectId)
      .order('week_start', { ascending: false });

    if (error) {
      console.error(`Failed to list digests for project ${projectId}:`, error);
      return [];
    }
    return data || [];
  }
};

export default digestService;
