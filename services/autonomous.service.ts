import supabaseService from './supabase.service';
import agentRuntimeService from './agent-runtime.service';
import agentMemoryService from './agent-memory.service';
import mcpService from './mcp.service';
import { emit } from '../lib/emit';
import { StreamEventType } from '../lib/stream-events';
import { AutonomousRun, PendingApproval, StartupAgent } from '../types';

export const autonomousService = {
  async startWeeklyRun(projectId: string, userId: string): Promise<AutonomousRun> {
    const supabase = supabaseService.getServiceClient();
    const weekStart = new Date().toISOString().split('T')[0];

    // Create autonomous_runs row
    const { data: run, error: runErr } = await supabase
      .from('autonomous_runs')
      .insert({
        project_id: projectId,
        week_start: weekStart,
        triggered_by: 'user',
        status: 'running',
        total_tasks: 0,
        completed_tasks: 0,
        emails_sent: 0,
        posts_created: 0,
        leads_found: 0
      })
      .select()
      .single();

    if (runErr || !run) {
      throw new Error(`Failed to initialize autonomous run: ${runErr?.message}`);
    }

    // Set project autonomous mode to active
    await supabase
      .from('projects')
      .update({ autonomous_mode: true })
      .eq('id', projectId);

    emit(projectId, StreamEventType.WEEKLY_RUN_STARTED,
      'Weekly autonomous run starting...',
      { detail: `Week of ${weekStart}` });

    // Run weekly orchestration asynchronously to not block the API request
    this.executeWeeklyOrchestration(run.id, projectId, userId).catch((err) => {
      console.error(`Orchestration execution failed for run ${run.id}:`, err);
    });

    return run;
  },

  async executeWeeklyOrchestration(runId: string, projectId: string, userId: string): Promise<void> {
    const supabase = supabaseService.getServiceClient();

    try {
      const { data: run, error: runFetchErr } = await supabase
        .from('autonomous_runs')
        .select('*')
        .eq('id', runId)
        .single();

      if (runFetchErr || !run) {
        throw new Error(`Weekly run record ${runId} not found: ${runFetchErr?.message}`);
      }

      // 1. Fetch active agents
      const { data: agents } = await supabase
        .from('startup_agents')
        .select('*')
        .eq('project_id', projectId)
        .eq('is_active', true);

      if (!agents || agents.length === 0) {
        throw new Error('No active startup agents found.');
      }

      const ceoAgent = agents.find((a) => a.role === 'ceo');
      if (!ceoAgent) {
        throw new Error('CEO agent must be deployed and active to start a weekly run.');
      }

      // Step 1 — CEO sets direction
      const ceoPrompt = `It's the start of a new week.
Review all agent outputs from last week.
Set top 3 priorities for this week.
Send specific task instructions to each team member using TO:{role}: format. 
For example:
TO:CMO: Draft a LinkedIn campaign about our new product feature.
TO:CTO: Create database schema spec for the user auth flow.`;

      const ceoTask = await agentRuntimeService.runAgentTask(
        ceoAgent.id,
        ceoPrompt,
        userId,
        'schedule',
        null
      );

      emit(projectId, StreamEventType.AGENT_COMPLETE,
        'CEO set weekly priorities',
        { agentName: 'CEO', status: 'done' });
 
      // Parse CEO output for tasks assigned to roles
      const roleTasks: Record<string, string> = {};
      if (ceoTask.output) {
        const lines = ceoTask.output.split('\n');
        let currentRole: string | null = null;
        let currentTaskText = '';

        for (const line of lines) {
          const match = line.match(/^TO\s*:\s*(CEO|CMO|CTO|CFO|CSO|CRO)\s*:\s*(.*)$/i);
          if (match) {
            if (currentRole) {
              roleTasks[currentRole.toLowerCase()] = currentTaskText.trim();
            }
            currentRole = match[1];
            currentTaskText = match[2];
          } else if (currentRole) {
            currentTaskText += '\n' + line;
          }
        }
        if (currentRole) {
          roleTasks[currentRole.toLowerCase()] = currentTaskText.trim();
        }
      }

      // Helper to execute task for a role with default fallback if not specified by CEO
      const runRole = async (role: string) => {
        const agent = agents.find((a) => a.role === role);
        if (!agent) return null;

        const description = roleTasks[role] || this.getDefaultTaskForRole(role);
        return await agentRuntimeService.runAgentTask(
          agent.id,
          description,
          userId,
          'schedule',
          ceoAgent.id
        );
      };

      // Step 3 — Run all agent tasks
      // CMO + CRO + CTO + CFO run in parallel.
      // CSO runs after CRO completes.
      const taskPromises: Promise<any>[] = [];
      
      const independentRoles = ['cmo', 'cto', 'cfo'];
      independentRoles.forEach((role) => {
        taskPromises.push(runRole(role));
      });

      // Sequence CRO -> CSO
      const croAndCsoSeq = runRole('cro').then(async (croTask) => {
        // Run CSO after CRO completes
        return await runRole('cso');
      });
      taskPromises.push(croAndCsoSeq);

      await Promise.all(taskPromises);

      // Step 5 — CEO Synthesizes accomplishments
      // Fetch latest completed tasks for this week's run
      const { data: runTasks } = await supabase
        .from('agent_tasks')
        .select('*, startup_agents(role, name)')
        .eq('project_id', projectId)
        .eq('triggered_by', 'schedule')
        .order('completed_at', { ascending: false });

      let tasksSummary = 'No team task outputs recorded.';
      if (runTasks && runTasks.length > 0) {
        tasksSummary = runTasks
          .map(
            (t: any) =>
              `### ${t.startup_agents?.name || 'Agent'} (${(t.startup_agents?.role || '').toUpperCase()})
Task: ${t.title}
Output:
${t.output || 'No output.'}`
          )
          .join('\n\n---\n\n');
      }

      const synthesisPrompt = `All team agents completed their weekly tasks. Here are their outputs:

${tasksSummary}

Read their outputs and produce a markdown summary with:
1. Weekly accomplishments summary (under 3 bullet points)
2. Key decisions made
3. Next week preview
4. Any blockers or concerns`;

      const ceoSynthesisTask = await agentRuntimeService.runAgentTask(
        ceoAgent.id,
        synthesisPrompt,
        userId,
        'schedule',
        null
      );

      // Step 6 — Save run summary and metrics
      // Calculate totals
      const totalTasksCount = (runTasks?.length || 0) + 2; // Tasks + CEO strategy + CEO synthesis
      const completedTasksCount =
        (runTasks?.filter((t) => t.status === 'done').length || 0) +
        (ceoSynthesisTask.status === 'done' ? 1 : 0) +
        (ceoTask.status === 'done' ? 1 : 0);

      // Fetch emails sent from tool_calls during this run window
      const { data: emailCalls } = await supabase
        .from('tool_calls')
        .select('id')
        .eq('project_id', projectId)
        .eq('tool_name', 'gmail_send')
        .eq('status', 'done')
        .gte('created_at', run.created_at);

      const { data: outreachLeadsCount } = await supabase
        .from('outreach_leads')
        .select('id')
        .eq('project_id', projectId)
        .gte('created_at', run.created_at);

      await supabase
        .from('autonomous_runs')
        .update({
          status: 'done',
          total_tasks: totalTasksCount,
          completed_tasks: completedTasksCount,
          emails_sent: emailCalls?.length || 0,
          leads_found: outreachLeadsCount?.length || 0,
          summary: ceoSynthesisTask.output || 'Accomplishments synthesis complete.'
        })
        .eq('id', runId);

      emit(projectId, StreamEventType.WEEKLY_RUN_COMPLETE,
        'Weekly run complete',
        {
          status: 'done',
          data: {
            tasksCompleted: completedTasksCount,
            emailsSent: emailCalls?.length || 0
          }
        });

      // Generate weekly digest automatically
      try {
        const { default: digestService } = await import('./digest.service');
        await digestService.generateWeeklyDigest(runId, projectId);
      } catch (digestErr) {
        console.error('Failed to generate weekly digest:', digestErr);
      }

      // Compute weekly analytics automatically
      try {
        const { default: analyticsService } = await import('./analytics.service');
        const weekStartStr = run.week_start;
        await analyticsService.computeWeeklyAnalytics(projectId, weekStartStr);
      } catch (analyticsErr) {
        console.error('Failed to compute weekly analytics:', analyticsErr);
      }

    } catch (err: any) {
      console.error(`Orchestration failure in run ${runId}:`, err);
      await supabase
        .from('autonomous_runs')
        .update({
          status: 'partial',
          summary: `Run encountered errors: ${err.message || String(err)}`
        })
        .eq('id', runId);
    }
  },

  async approveAction(approvalId: string, userId: string): Promise<PendingApproval> {
    const supabase = supabaseService.getServiceClient();

    // Fetch approval
    const { data: approval, error: fetchErr } = await supabase
      .from('pending_approvals')
      .select('*')
      .eq('id', approvalId)
      .single();

    if (fetchErr || !approval) {
      throw new Error(`Pending approval not found: ${fetchErr?.message || 'unknown id'}`);
    }

    if (approval.status !== 'pending') {
      return approval;
    }

    // 1. Update approval status to approved
    const { data: updatedApproval, error: updateErr } = await supabase
      .from('pending_approvals')
      .update({
        status: 'approved',
        decided_at: new Date().toISOString()
      })
      .eq('id', approvalId)
      .select()
      .single();

    if (updateErr || !updatedApproval) {
      throw new Error(`Failed to approve: ${updateErr?.message}`);
    }

    // 2. Check task status to see if agent thread is still active
    const { data: task } = await supabase
      .from('agent_tasks')
      .select('status, output')
      .eq('id', approval.task_id)
      .single();

    const isAgentThreadActive = task && task.status === 'running';

    if (!isAgentThreadActive) {
      // Agent timed out or is inactive; execute action directly on behalf of agent
      let toolResult: any;
      const actionType = approval.action_type;
      const actionData = approval.action_data as Record<string, any>;

      try {
        if (actionType === 'send_email') {
          toolResult = await mcpService.callTool(
            'gmail',
            'gmail_send',
            { to: actionData.to, subject: actionData.subject, body: actionData.body },
            approval.agent_id,
            approval.project_id,
            null,
            userId
          );
        } else if (actionType === 'post_content') {
          const connectorSlug = actionData.platform || actionData.channel || 'slack';
          toolResult = await mcpService.callTool(
            connectorSlug,
            actionData.tool_name || 'post_message',
            actionData,
            approval.agent_id,
            approval.project_id,
            null,
            userId
          );
        } else {
          toolResult = { success: true, message: 'Action approved and logged.' };
        }
      } catch (execErr: any) {
        console.error('Direct execution of approved action failed:', execErr);
        toolResult = { success: false, error: execErr.message };
      }

      // Log execution output back to the task
      if (task) {
        const appendedOutput = (task.output || '') + `\n\n[User Approved Action Direct Execution Result]:\n${JSON.stringify(toolResult, null, 2)}`;
        await supabase
          .from('agent_tasks')
          .update({ output: appendedOutput })
          .eq('id', approval.task_id);
      }
    }

    return updatedApproval;
  },

  async rejectAction(approvalId: string, userId: string, reason?: string): Promise<PendingApproval> {
    const supabase = supabaseService.getServiceClient();

    const { data: updatedApproval, error } = await supabase
      .from('pending_approvals')
      .update({
        status: 'rejected',
        decided_at: new Date().toISOString()
      })
      .eq('id', approvalId)
      .select()
      .single();

    if (error || !updatedApproval) {
      throw new Error(`Failed to reject: ${error?.message}`);
    }

    // Notify agent memory
    await agentMemoryService.saveMemory(
      updatedApproval.agent_id,
      updatedApproval.project_id,
      'fact',
      `Action execution rejected by user: ${reason || 'No reason provided'}.`
    );

    return updatedApproval;
  },

  async getWeeklyRuns(projectId: string): Promise<AutonomousRun[]> {
    const supabase = supabaseService.getClient();
    const { data, error } = await supabase
      .from('autonomous_runs')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error(`Failed to list weekly runs for project ${projectId}:`, error);
      return [];
    }
    return data || [];
  },

  getDefaultTaskForRole(role: string): string {
    switch (role) {
      case 'cmo':
        return 'Create a draft marketing campaign outline and drafting LinkedIn product marketing copies.';
      case 'cto':
        return 'Draft database specs, software architecture documents, and REST API contract endpoints.';
      case 'cfo':
        return 'Analyze pricing strategies, modeling unit economics, CAC, and LTV projections.';
      case 'cro':
        return 'Conduct competitor analysis and synthesize market landscape research findings.';
      case 'cso':
        return 'Perform prospect research, scraping target market leads, and writing cold outreach email drafts.';
      default:
        return 'Execute strategy roadmap tasks and collaborate with team members.';
    }
  }
};

export default autonomousService;
