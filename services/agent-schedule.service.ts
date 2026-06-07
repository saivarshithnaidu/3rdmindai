import supabaseService from './supabase.service';
import { StartupAgent, AgentRole } from '../types';

export function getNextTriggerTime(cronExpression: string): string {
  const parts = cronExpression.trim().split(/\s+/);
  if (parts.length !== 5) {
    // Fallback: 1 hour from now
    return new Date(Date.now() + 60 * 60 * 1000).toISOString();
  }

  const [minStr, hourStr, domStr, monthStr, dowStr] = parts;
  const now = new Date();
  
  // Start calculating from today, reset seconds/ms
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), now.getMinutes(), 0, 0);

  const targetMin = parseInt(minStr, 10) || 0;
  const targetHour = parseInt(hourStr, 10) || 0;

  next.setHours(targetHour);
  next.setMinutes(targetMin);

  // If next is in the past, add 1 day
  if (next.getTime() <= now.getTime()) {
    next.setDate(next.getDate() + 1);
  }

  // Handle day-of-week constraints
  if (dowStr !== '*' && dowStr !== '?') {
    const daysAllowed: number[] = [];
    if (dowStr.includes('-')) {
      const [start, end] = dowStr.split('-').map(Number);
      for (let i = start; i <= end; i++) {
        daysAllowed.push(i);
      }
    } else if (dowStr.includes(',')) {
      dowStr.split(',').forEach((d) => daysAllowed.push(Number(d)));
    } else {
      daysAllowed.push(Number(dowStr));
    }

    let attempts = 0;
    while (!daysAllowed.includes(next.getDay()) && attempts < 365) {
      next.setDate(next.getDate() + 1);
      attempts++;
    }
  }

  return next.toISOString();
}

export const agentScheduleService = {
  async createDefaultSchedules(projectId: string, agents: StartupAgent[]): Promise<void> {
    const supabase = supabaseService.getServiceClient();

    // Check if schedules already exist for these agents to prevent duplication
    const agentIds = agents.map((a) => a.id);
    const { data: existing } = await supabase
      .from('agent_schedules')
      .select('agent_id')
      .in('agent_id', agentIds);

    const existingAgentIds = new Set((existing || []).map((s) => s.agent_id));

    const defaults = [
      {
        role: 'ceo',
        cron: '0 9 * * 1', // Monday 9am
        template: `Review all agent outputs from last week.
Set top 3 priorities for this week.
Send direction messages to each agent.`,
      },
      {
        role: 'cmo',
        cron: '0 10 * * 2', // Tuesday 10am
        template: `Generate 5 social media posts for this week based on current strategy. Save to Notion.`,
      },
      {
        role: 'cro',
        cron: '0 8 * * 1', // Monday 8am
        template: `Research top 3 competitors this week.
Look for any product or pricing changes.
Produce intelligence report.`,
      },
      {
        role: 'cso',
        cron: '0 9 * * 1-5', // weekday 9am
        template: `Find 5 new leads matching our ICP.
Write personalized outreach for each.
Send via Gmail if connector active.`,
      },
    ];

    for (const def of defaults) {
      const agent = agents.find((a) => a.role === def.role);
      if (agent && !existingAgentIds.has(agent.id)) {
        const nextTrigger = getNextTriggerTime(def.cron);
        await supabase.from('agent_schedules').insert({
          agent_id: agent.id,
          project_id: projectId,
          task_template: def.template,
          cron_expression: def.cron,
          is_active: true,
          next_trigger: nextTrigger,
        });
      }
    }
  },

  async createSchedule(
    agentId: string,
    projectId: string,
    taskTemplate: string,
    cronExpression: string
  ): Promise<any> {
    const supabase = supabaseService.getServiceClient();
    const nextTrigger = getNextTriggerTime(cronExpression);

    const { data, error } = await supabase
      .from('agent_schedules')
      .insert({
        agent_id: agentId,
        project_id: projectId,
        task_template: taskTemplate,
        cron_expression: cronExpression,
        is_active: true,
        next_trigger: nextTrigger,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create schedule: ${error.message}`);
    }
    return data;
  },

  async checkAndRunScheduled(projectId?: string): Promise<number> {
    const supabase = supabaseService.getServiceClient();
    let dbQuery = supabase
      .from('agent_schedules')
      .select('*')
      .eq('is_active', true)
      .lte('next_trigger', new Date().toISOString());

    if (projectId) {
      dbQuery = dbQuery.eq('project_id', projectId);
    }

    const { data: schedules, error } = await dbQuery;
    if (error || !schedules || schedules.length === 0) return 0;

    let triggeredCount = 0;
    for (const sched of schedules) {
      try {
        const { data: agent } = await supabase
          .from('startup_agents')
          .select('role')
          .eq('id', sched.agent_id)
          .single();

        const roleName = (agent?.role || 'agent').toUpperCase();
        const title = `Scheduled Run: ${roleName}`;

        const { agentRuntimeService } = await import('./agent-runtime.service');
        await agentRuntimeService.queueTask(
          sched.agent_id,
          sched.project_id,
          title,
          sched.task_template,
          'schedule'
        );

        const nextTrigger = getNextTriggerTime(sched.cron_expression);

        await supabase
          .from('agent_schedules')
          .update({
            last_triggered: new Date().toISOString(),
            next_trigger: nextTrigger,
          })
          .eq('id', sched.id);

        triggeredCount++;
      } catch (err) {
        console.error(`Failed executing scheduled task for agent schedule ${sched.id}:`, err);
      }
    }
    return triggeredCount;
  },
};

export default agentScheduleService;
