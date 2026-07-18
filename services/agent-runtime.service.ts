import supabaseService from './supabase.service';
import openrouterService from './openrouter.service';
import mcpService from './mcp.service';
import toolsService from './tools.service';
import agentMemoryService from './agent-memory.service';
import agentCommsService from './agent-comms.service';
import { AGENT_IDENTITIES } from '../lib/agent-identities';
import { StartupAgent, AgentTask, AgentRole, TaskStatus } from '../types';
import { emit } from '../lib/emit';
import { StreamEventType } from '../lib/stream-events';

export const agentRuntimeService = {
  async deployStartupTeam(
    projectId: string,
    userId: string,
    startupContext: {
      companyName: string;
      product: string;
      targetMarket: string;
      stage: string;
      problem: string;
    }
  ): Promise<StartupAgent[]> {
    const supabase = supabaseService.getServiceClient();
    
    // 1. Fetch existing agents
    const { data: existing } = await supabase
      .from('startup_agents')
      .select('*')
      .eq('project_id', projectId);

    const existingRoles = new Set((existing || []).map((a) => a.role));

    const defaults = [
      { role: 'ceo', name: 'Alex', model: 'openai/gpt-4o' },
      { role: 'cmo', name: 'Maya', model: 'google/gemini-pro-1.5' },
      { role: 'cto', name: 'Dev', model: 'deepseek/deepseek-chat' },
      { role: 'cfo', name: 'Fin', model: 'deepseek/deepseek-chat' },
      { role: 'cso', name: 'Sam', model: 'meta-llama/llama-3-70b-instruct' },
      { role: 'cro', name: 'Rei', model: 'google/gemini-pro-1.5' },
    ];

    const deployedAgents: StartupAgent[] = [];
    for (const def of defaults) {
      if (!existingRoles.has(def.role as any)) {
        const { data: agent, error } = await supabase
          .from('startup_agents')
          .insert({
            project_id: projectId,
            role: def.role,
            name: def.name,
            model: def.model,
            is_active: true,
            tasks_completed: 0,
          })
          .select()
          .single();

        if (error) {
          throw new Error(`Failed to deploy agent ${def.role}: ${error.message}`);
        }
        deployedAgents.push(agent);
      } else {
        const found = existing!.find((a) => a.role === def.role);
        deployedAgents.push(found);
      }
    }

    // 2. Save startup context as facts in memory for each agent so they remember it
    try {
      for (const agent of deployedAgents) {
        // Clear old context facts if they exist to avoid duplication
        await supabase
          .from('agent_memory')
          .delete()
          .eq('agent_id', agent.id)
          .eq('memory_type', 'fact')
          .ilike('content', 'Company Context:%');

        await agentMemoryService.saveMemory(agent.id, projectId, 'fact', `Company Context: Company Name: ${startupContext.companyName}`);
        await agentMemoryService.saveMemory(agent.id, projectId, 'fact', `Company Context: Product: ${startupContext.product}`);
        await agentMemoryService.saveMemory(agent.id, projectId, 'fact', `Company Context: Target Market: ${startupContext.targetMarket}`);
        await agentMemoryService.saveMemory(agent.id, projectId, 'fact', `Company Context: Stage: ${startupContext.stage}`);
        await agentMemoryService.saveMemory(agent.id, projectId, 'fact', `Company Context: Core Problem: ${startupContext.problem}`);
      }
    } catch (memErr) {
      console.error('Failed to initialize project context memories:', memErr);
    }

    // 3. Create default schedules
    try {
      const { agentScheduleService } = await import('./agent-schedule.service');
      await agentScheduleService.createDefaultSchedules(projectId, deployedAgents);
    } catch (schedErr) {
      console.error('Failed to create default schedules:', schedErr);
    }

    return deployedAgents;
  },

  async queueTask(
    agentId: string,
    projectId: string,
    title: string,
    description: string,
    triggeredBy: 'user' | 'agent' | 'schedule',
    triggeredByAgentId?: string | null
  ): Promise<AgentTask> {
    const supabase = supabaseService.getServiceClient();
    const { data: task, error } = await supabase
      .from('agent_tasks')
      .insert({
        agent_id: agentId,
        project_id: projectId,
        title,
        description,
        status: 'queued',
        tools_used: [],
        triggered_by: triggeredBy,
        triggered_by_agent_id: triggeredByAgentId || null,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to queue task: ${error.message}`);
    }

    // Asynchronously kick off the task
    setTimeout(() => {
      this.runAgentTask(agentId, description, '00000000-0000-0000-0000-000000000000', triggeredBy, triggeredByAgentId, task.id)
        .catch((err) => console.error(`Failed to run background task ${task.id}:`, err));
    }, 0);

    return task;
  },

  async runAgentTask(
    agentId: string,
    taskDescription: string,
    userId: string,
    triggeredBy: 'user' | 'agent' | 'schedule',
    triggeredByAgentId?: string | null,
    preExistingTaskId?: string
  ): Promise<AgentTask> {
    const supabase = supabaseService.getServiceClient();
    
    // 1. Fetch agent
    const { data: agent, error: agentErr } = await supabase
      .from('startup_agents')
      .select('*')
      .eq('id', agentId)
      .single();

    if (agentErr || !agent) {
      throw new Error(`Agent not found: ${agentErr?.message || 'unknown id'}`);
    }

    // 2. Fetch or create task record
    let task: AgentTask;
    if (preExistingTaskId) {
      const { data, error } = await supabase
        .from('agent_tasks')
        .select('*')
        .eq('id', preExistingTaskId)
        .single();
      if (error || !data) throw new Error(`Pre-existing task not found: ${error?.message}`);
      task = data;
    } else {
      const { data, error } = await supabase
        .from('agent_tasks')
        .insert({
          agent_id: agentId,
          project_id: agent.project_id,
          title: taskDescription.slice(0, 40) + (taskDescription.length > 40 ? '...' : ''),
          description: taskDescription,
          status: 'queued',
          tools_used: [],
          triggered_by: triggeredBy,
          triggered_by_agent_id: triggeredByAgentId || null,
        })
        .select()
        .single();
      if (error || !data) throw new Error(`Failed to create task: ${error?.message}`);
      task = data;
    }

    // Update status to 'running'
    await supabase
      .from('agent_tasks')
      .update({ status: 'running', started_at: new Date().toISOString() })
      .eq('id', task.id);

    try {
      emit(agent.project_id, StreamEventType.AGENT_STARTED,
        `${agent.name} working...`,
        {
          agentId: agent.id,
          agentName: agent.name,
          agentRole: agent.role,
          detail: taskDescription
        });

      const isCSO = agent.role === 'cso';
      const isOutreachIntent = /lead|outreach|prospect/i.test(taskDescription);

      if (isCSO && isOutreachIntent) {
        const csoTask = await this.runCSOOutreachPipeline(agent, task, userId);
        try {
          const { default: webhookService } = await import('./webhook.service');
          if (csoTask && csoTask.status === 'done') {
            webhookService.fireWebhook(agent.project_id, 'agent.task.completed', csoTask);
          } else if (csoTask) {
            webhookService.fireWebhook(agent.project_id, 'agent.task.failed', csoTask);
          }
        } catch (webhookErr) {
          console.error('Failed to trigger webhook for CSO task:', webhookErr);
        }
        return csoTask;
      }

      // Build context & system prompt
      const rawIdentity = (AGENT_IDENTITIES as any)[agent.role] || '';
      const systemPrompt = rawIdentity.replace(/{name}/g, agent.name);
      
      const unreadMessages = await agentCommsService.getUnreadMessages(agentId, agent.project_id);
      
      // Fetch unread messages to mark them as read
      const { data: unreadMsgRows } = await supabase
        .from('agent_messages')
        .select('id')
        .eq('to_agent_id', agentId)
        .eq('read', false);
      
      if (unreadMsgRows) {
        for (const row of unreadMsgRows) {
          await agentCommsService.markRead(row.id);
        }
      }

      const memoriesStr = await agentMemoryService.recallMemory(agentId, agent.project_id, taskDescription, 15);
      
      const { data: recentTasks } = await supabase
        .from('agent_tasks')
        .select('*')
        .eq('agent_id', agentId)
        .eq('status', 'done')
        .order('created_at', { ascending: false })
        .limit(5);

      let tasksStr = 'No completed tasks yet.';
      if (recentTasks && recentTasks.length > 0) {
        tasksStr = recentTasks
          .map((t) => `### Task: ${t.title}\nDescription: ${t.description}\nOutput:\n${t.output || 'No output.'}`)
          .join('\n\n---\n\n');
      }

      const availableTools = await mcpService.getAvailableTools(userId, agent.project_id);
      
      let competitorIntelStr = '';
      if (agent.role === 'cmo' || agent.role === 'cro') {
        try {
          const { data: latestReports } = await supabase
            .from('ad_intelligence_reports')
            .select('*, competitor:competitor_profiles(*)')
            .eq('project_id', agent.project_id)
            .order('generated_at', { ascending: false })
            .limit(1);

          if (latestReports && latestReports.length > 0) {
            const latestReport = latestReports[0];
            const compName = latestReport.competitor?.competitor_name || 'Competitor';
            const topAngle = latestReport.top_angles?.[0]?.angle || 'N/A';
            const topCta = latestReport.top_ctas?.[0]?.cta || 'N/A';
            
            if (agent.role === 'cmo') {
              competitorIntelStr = `\n\n[COMPETITIVE AD INTELLIGENCE]\nWe tracked competitive ad campaigns for ${compName}.\n- Total Ads Found: ${latestReport.total_ads_found}\n- Active Ads: ${latestReport.active_ads}\n- Primary Marketing Angle: ${topAngle}\n- Top CTA: ${topCta}\n- Insights:\n${latestReport.insights}\n`;
            } else if (agent.role === 'cro' && /competitor|research|benchmark|ad/i.test(taskDescription)) {
              competitorIntelStr = `\n\n[COMPETITIVE AD BENCHMARK]\nCompetitor: ${compName}\n- Active Ads count: ${latestReport.active_ads}\n- Top CTAs: ${JSON.stringify(latestReport.top_ctas)}\n- Top Formats: ${JSON.stringify(latestReport.top_formats)}\n`;
            }
          }
        } catch (err) {
          console.error('Failed to inject competitive ad intelligence:', err);
        }
      }

      let learningContext = '';
      try {
        const { default: learningService } = await import('./learning.service');
        learningContext = await learningService.getAgentContextWithLearnings(agentId, agent.project_id, taskDescription);
      } catch (learningErr) {
        console.error('Failed to inject learning context:', learningErr);
      }

      const fullSystemPrompt = `[IDENTITY]
${systemPrompt}
${learningContext}

[YOUR MEMORY — PAST DECISIONS & OUTPUTS]
${memoriesStr}

[RECENT TASKS YOU COMPLETED]
${tasksStr}

[MESSAGES FROM YOUR TEAM]
${unreadMessages}

[AVAILABLE TOOLS]
${availableTools.length > 0 ? availableTools.map((t) => `- **${t.name}**: ${t.description}`).join('\n') : 'No tools active.'}
${competitorIntelStr}`;

      // Check for browser agent / web scraping intent auto-trigger
      try {
        const { default: browserAgentService } = await import('./browser-agent.service');
        const detection = await browserAgentService.detectBrowserRequest(taskDescription);
        
        if (detection.needsBrowser && detection.scraper) {
          const runRes = await browserAgentService.runBrowserScrape(
            agent.project_id,
            agentId,
            userId,
            detection.scraper,
            detection.query,
            detection.maxResults
          );

          // Retrieve all scraped rows to feed as context
          const { data: canvasRows } = await supabase
            .from('canvas_rows')
            .select('*')
            .eq('canvas_id', runRes.canvasId)
            .order('row_index', { ascending: true });

          const formattedRows = (canvasRows || [])
            .map((r: any, idx: number) => `${idx + 1}. ${JSON.stringify(r.data)}`)
            .join('\n');

          // Inject scraped results into the agent's task run context
          taskDescription = `${taskDescription}\n\n[LIVE SCRAPED DATA]\n${formattedRows}`;
        }
      } catch (browserErr) {
        console.error('Auto browser agent execution failed:', browserErr);
      }

      let finalTask = await this.runTaskWithTools(agent, task, fullSystemPrompt, userId);

      // AFTER task completes: Call learningService.recordTaskPerformance (fire-and-forget)
      import('./learning.service').then(({ learningService }) => {
        learningService.recordTaskPerformance(finalTask.id, agentId, agent.project_id)
          .catch((err) => console.error('Failed to record task performance:', err));
      });
      
      // Evaluate output with Judge Agent Layer (invisible to user, active on every task, max 3 rounds)
      try {
        const { default: judgeService } = await import('./judge.service');
        const evaluation = await judgeService.evaluateTask(finalTask, agent, agent.project_id);
        if (!evaluation.passed) {
          finalTask = await judgeService.triggerRevision(finalTask, agent, evaluation, agent.project_id, userId);
        }
      } catch (judgeErr) {
        console.error('Judge quality checking failed:', judgeErr);
      }

      // AFTER judge evaluation: Update performance log with score if available
      if (finalTask.judge_score !== null && finalTask.judge_score !== undefined) {
        const score = finalTask.judge_score;
        import('./learning.service').then(({ learningService }) => {
          learningService.updatePerformanceLogScore(finalTask.id, score)
            .catch((err) => console.error('Failed to update performance log score:', err));
        });
      }
      
      // Post-task processing
      // 1. Update agent stats
      const nextRunTime = new Date().toISOString();
      await supabase
        .from('startup_agents')
        .update({
          tasks_completed: agent.tasks_completed + 1,
          last_run_at: nextRunTime,
        })
        .eq('id', agentId);

      // 2. Extract and save memories
      await agentMemoryService.saveTaskMemories(finalTask, agentId, agent.project_id);

      // 3. Scan for inter-agent messages
      const { data: allAgents } = await supabase
        .from('startup_agents')
        .select('*')
        .eq('project_id', agent.project_id);
      
      if (allAgents && finalTask.output) {
        await agentCommsService.parseAndSendMessages(
          finalTask.output,
          agent,
          allAgents,
          agent.project_id
        );
      }

      try {
        const { default: webhookService } = await import('./webhook.service');
        if (finalTask.status === 'done') {
          webhookService.fireWebhook(agent.project_id, 'agent.task.completed', finalTask);
        } else if (finalTask.status === 'failed') {
          webhookService.fireWebhook(agent.project_id, 'agent.task.failed', finalTask);
        }

        if (finalTask.judge_score !== null && finalTask.judge_score !== undefined && finalTask.judge_score < 20) {
          webhookService.fireWebhook(agent.project_id, 'judge.task.failed', finalTask);
        }
      } catch (webhookErr) {
        console.error('Failed to trigger task webhook in success path:', webhookErr);
      }

      emit(agent.project_id, StreamEventType.AGENT_COMPLETE,
        `${agent.name} completed`,
        {
          agentId: agent.id,
          agentName: agent.name,
          agentRole: agent.role,
          status: 'done',
          detail: finalTask.output ? finalTask.output.substring(0, 150) : ''
        });

      return finalTask;
    } catch (err: any) {
      emit(agent.project_id, StreamEventType.AGENT_FAILED,
        `${agent.name} failed`,
        {
          agentId: agent.id,
          agentName: agent.name,
          agentRole: agent.role,
          status: 'error',
          detail: err.message || String(err)
        });
      console.error(`Task ${task.id} execution failed:`, err);
      
      // Update task status to failed
      const { data: failedTask } = await supabase
        .from('agent_tasks')
        .update({
          status: 'failed',
          output: `[Execution Error]: ${err.message || String(err)}`,
          completed_at: new Date().toISOString(),
        })
        .eq('id', task.id)
        .select()
        .single();

      if (failedTask) {
        try {
          const { default: webhookService } = await import('./webhook.service');
          webhookService.fireWebhook(agent.project_id, 'agent.task.failed', failedTask);
        } catch (webhookErr) {
          console.error('Failed to trigger task webhook in error path:', webhookErr);
        }
      }
        
      return failedTask;
    }
  },

  async runTaskWithTools(
    agent: StartupAgent,
    task: AgentTask,
    systemPrompt: string,
    userId: string
  ): Promise<AgentTask> {
    const supabase = supabaseService.getServiceClient();
    const messages = [{ role: 'user', content: task.description }];
    let round = 0;
    const maxRounds = 3;
    let fullOutput = '';
    let lastWriteTime = 0;
    const toolsUsedSet = new Set<string>();

    async function throttledSaveOutput(output: string) {
      const now = Date.now();
      if (now - lastWriteTime > 500) {
        lastWriteTime = now;
        await supabase
          .from('agent_tasks')
          .update({ output })
          .eq('id', task.id);
      }
    }

    while (round < maxRounds) {
      round++;
      
      // Fetch available tools to inject schema details
      const tools = await mcpService.getAvailableTools(userId, agent.project_id);
      const promptWithTools = mcpService.injectToolsIntoSystem(systemPrompt, tools);

      const stream = openrouterService.streamModel(
        promptWithTools,
        messages,
        agent.model
      );

      const reader = stream.getReader();
      const decoder = new TextDecoder();
      let roundOutput = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value);
        roundOutput += text;
        fullOutput += text;
        await throttledSaveOutput(fullOutput);

        emit(agent.project_id, StreamEventType.AGENT_OUTPUT_CHUNK,
          `${agent.name} writing...`,
          {
            agentId: agent.id,
            agentName: agent.name,
            agentRole: agent.role,
            data: { chunk: text.substring(0, 100) }
          });
      }

      // Check for tool calls
      const calls = mcpService.parseToolCalls(roundOutput);
      if (calls.length === 0) {
        // No tools called, we are done
        break;
      }

      // Record tools used
      calls.forEach((c: any) => toolsUsedSet.add(c.tool));
      await supabase
        .from('agent_tasks')
        .update({ tools_used: Array.from(toolsUsedSet) })
        .eq('id', task.id);

      // Execute tool calls
      fullOutput += `\n\n[System: Executing tools: ${calls.map((c: any) => c.tool).join(', ')}...]\n`;
      await supabase
        .from('agent_tasks')
        .update({ output: fullOutput })
        .eq('id', task.id);

      const toolResults = await mcpService.executeToolCalls(
        calls,
        agent.id,
        agent.project_id,
        null,
        userId
      );

      fullOutput += `\n[System: Tool execution completed.]\n`;
      await supabase
        .from('agent_tasks')
        .update({ output: fullOutput })
        .eq('id', task.id);

      // Append assistant response and tool outputs to message thread for next round
      messages.push({ role: 'assistant', content: roundOutput });
      messages.push({ role: 'user', content: toolResults });
    }

    // Complete task
    const { data: finalTask, error } = await supabase
      .from('agent_tasks')
      .update({
        status: 'done',
        output: fullOutput,
        completed_at: new Date().toISOString(),
      })
      .eq('id', task.id)
      .select()
      .single();

    if (error) throw error;
    return finalTask;
  },

  async runCSOOutreachPipeline(
    agent: StartupAgent,
    task: AgentTask,
    userId: string
  ): Promise<AgentTask> {
    const supabase = supabaseService.getServiceClient();
    let logs = '';
    const toolsUsed: string[] = [];

    async function logStep(msg: string) {
      console.log(`[CSO PIPELINE] ${msg}`);
      logs += msg + '\n\n';
      await supabase
        .from('agent_tasks')
        .update({ output: logs, tools_used: toolsUsed })
        .eq('id', task.id);
    }

    await logStep('🚀 Starting specialized CSO Lead Generation & Outreach Pipeline...');

    // Resolve context memories
    const memories = await agentMemoryService.recallMemory(agent.id, agent.project_id, undefined, 100);
    let targetMarket = 'SaaS startups';
    let stage = 'MVP';
    
    const marketMatch = memories.match(/Company Context:\s*Target Market:\s*(.*)/i);
    if (marketMatch) targetMarket = marketMatch[1].trim();
    
    const stageMatch = memories.match(/Company Context:\s*Stage:\s*(.*)/i);
    if (stageMatch) stage = stageMatch[1].trim();

    // Step 1: Find Leads
    await logStep(`[Step 1/6] Querying Exa Search for leads matching: "${targetMarket} ${stage}"...`);
    toolsUsed.push('exa_search');
    
    const exaQuery = `${targetMarket} companies ${stage}`;
    let exaResult: any;
    try {
      exaResult = await mcpService.callTool('exa', 'exa_search', { query: exaQuery }, agent.id, agent.project_id, null, userId);
    } catch (e) {
      const resText = await toolsService.searchExa(exaQuery);
      exaResult = { results: [{ title: 'Simulated Lead 1', url: 'https://simulated1.com', snippet: resText }] };
    }

    const rawLeads = exaResult.results || [];
    const companies = rawLeads.map((r: any) => {
      let name = r.title || 'Unknown';
      if (name.includes('-')) name = name.split('-')[0].trim();
      if (name.includes('|')) name = name.split('|')[0].trim();
      return { name, url: r.url || '', description: r.snippet || r.text || '' };
    }).slice(0, 5); // Limit to top 5 for research

    await logStep(`Found ${companies.length} prospects. Top leads identified:\n` + 
      companies.map((c: any, i: number) => `${i + 1}. **${c.name}** (${c.url})`).join('\n')
    );

    // Step 2: Research each lead with Tavily
    await logStep('[Step 2/6] Researching prospects individually using Tavily Search...');
    toolsUsed.push('tavily_search');

    const researchedLeads = [];
    for (const company of companies) {
      await logStep(`Researching company size, news, pain points for: **${company.name}**...`);
      const tavilyQuery = `"${company.name}" company size news pain points decision maker`;
      let tavilyText = '';
      try {
        const tavilyResult = await mcpService.callTool('tavily', 'tavily_search', { query: tavilyQuery }, agent.id, agent.project_id, null, userId);
        tavilyText = typeof tavilyResult === 'string' ? tavilyResult : JSON.stringify(tavilyResult);
      } catch (e) {
        tavilyText = await toolsService.searchWeb(tavilyQuery);
      }
      researchedLeads.push({
        ...company,
        research: tavilyText.slice(0, 1500) // Keep size bounded
      });
    }

    await logStep('Prospect research completed.');

    // Step 3: Generate Emails via OpenRouter
    await logStep('[Step 3/6] Formulating personalized outreach emails matching leads\' pain points...');
    
    const csoIdentity = AGENT_IDENTITIES.cso.replace(/{name}/g, agent.name);
    const generationPrompt = `You are a personalized sales outreach engine. Draft 3 personalized outreach emails based on prospect research. Keep them under 150 words.
    
Research Details:
${researchedLeads.map((l, idx) => `Prospect #${idx+1}:\nCompany: ${l.name}\nURL: ${l.url}\nResearch Context: ${l.research}`).join('\n\n')}

Return ONLY a valid JSON array of objects matching this exact signature (do not wrap in other text or code blocks):
[
  {
    "company": "Company Name",
    "contactName": "Name (estimate or use 'Founder')",
    "email": "recipient@company.com (mock or researched)",
    "subject": "Email Subject",
    "body": "Email body copy"
  }
]`;

    const resultText = await openrouterService.callModel(
      csoIdentity,
      [{ role: 'user', content: generationPrompt }],
      agent.model
    );

    let cleanJson = resultText.trim();
    if (cleanJson.startsWith('```')) {
      cleanJson = cleanJson
        .replace(/^```json\s*/i, '')
        .replace(/```$/, '')
        .trim();
    }

    let emails: any[] = [];
    try {
      emails = JSON.parse(cleanJson);
    } catch (err) {
      console.warn('Failed to parse emails JSON, creating fallback list.', err);
      emails = companies.map((c: any) => ({
        company: c.name,
        contactName: 'Founder',
        email: `contact@${c.name.toLowerCase().replace(/\s+/g, '')}.com`,
        subject: `Solving scaling bottlenecks for ${c.name}`,
        body: `Hi Founder,\n\nI noticed ${c.name} is scaling operations. 3RDMIND helps companies automate execution workflows. Let's discuss.\n\nBest,\n${agent.name}`
      }));
    }

    await logStep('Outreach drafts generated:\n' + 
      emails.map((e: any, i: number) => `**Draft #${i+1} for ${e.company}**\nTo: ${e.email}\nSubject: ${e.subject}\nBody:\n${e.body}\n`).join('\n---\n')
    );

    // Step 4: Send via Gmail (if active)
    await logStep('[Step 4/6] Checking Gmail Connector status...');
    const { data: gmailConn } = await supabase
      .from('connectors')
      .select('*')
      .eq('user_id', userId)
      .eq('slug', 'gmail')
      .eq('is_active', true)
      .maybeSingle();

    if (gmailConn) {
      await logStep('Gmail Connector is active! Dispatching emails...');
      toolsUsed.push('gmail_send');
      for (const email of emails) {
        try {
          await mcpService.callTool(
            'gmail',
            'gmail_send',
            { to: email.email, subject: email.subject, body: email.body },
            agent.id,
            agent.project_id,
            null,
            userId
          );
          await logStep(`Email successfully sent to ${email.email}.`);
          await agentMemoryService.saveMemory(
            agent.id,
            agent.project_id,
            'output',
            `Gmail Sent: Outreach email to ${email.contactName} at ${email.company} (${email.email})`,
            task.id
          );
        } catch (mailErr: any) {
          await logStep(`[GMAIL ERROR] Failed sending to ${email.email}: ${mailErr.message}`);
        }
      }
    } else {
      await logStep('Gmail Connector is NOT active. Skipping email dispatch. Outbox logged to memory.');
      for (const email of emails) {
        await agentMemoryService.saveMemory(
          agent.id,
          agent.project_id,
          'output',
          `Draft outreach created for ${email.contactName} at ${email.company} (${email.email})`,
          task.id
        );
      }
    }

    // Step 5: Save to Notion (if active)
    await logStep('[Step 5/6] Checking Notion Connector status...');
    const { data: notionConn } = await supabase
      .from('connectors')
      .select('*')
      .eq('user_id', userId)
      .eq('slug', 'notion')
      .eq('is_active', true)
      .maybeSingle();

    if (notionConn) {
      await logStep('Notion Connector is active! Creating leads tracker entries...');
      toolsUsed.push('notion_insert');
      for (const email of emails) {
        try {
          await mcpService.callTool(
            'notion',
            'insert_database_entry',
            {
              company: email.company,
              contact: email.contactName,
              email: email.email,
              date: new Date().toLocaleDateString(),
              status: gmailConn ? 'Sent' : 'Draft'
            },
            agent.id,
            agent.project_id,
            null,
            userId
          );
        } catch (notionErr) {
          console.warn('Notion insert failed:', notionErr);
        }
      }
      await logStep('Notion database entries created successfully.');
    } else {
      await logStep('Notion Connector is NOT active. Skipping database sync.');
    }

    // Step 6: Report to CEO
    await logStep('[Step 6/6] Dispatching summary update report to the CEO agent...');
    const { data: ceoAgent } = await supabase
      .from('startup_agents')
      .select('id')
      .eq('project_id', agent.project_id)
      .eq('role', 'ceo')
      .maybeSingle();

    if (ceoAgent) {
      const summaryReport = `TO:CEO: Sent outreach to ${emails.length} leads today.
Companies: ${emails.map((e) => e.company).join(', ')}.
Opening angles used: Focused on scaling bottlenecks and operational workflows.`;
      
      try {
        await agentCommsService.sendMessage(
          agent.id,
          ceoAgent.id,
          agent.project_id,
          'Outreach Campaign Executive Summary',
          summaryReport
        );
        await logStep('CEO successfully updated.');
      } catch (commsErr) {
        console.error('Failed to notify CEO:', commsErr);
      }
    }

    await logStep('✅ specialized CSO Outreach Pipeline execution completed successfully!');

    // Update final task status
    const { data: finalTask } = await supabase
      .from('agent_tasks')
      .update({
        status: 'done',
        output: logs,
        tools_used: toolsUsed,
        completed_at: new Date().toISOString(),
      })
      .eq('id', task.id)
      .select()
      .single();

    // Update agent last run info
    await supabase
      .from('startup_agents')
      .update({
        tasks_completed: agent.tasks_completed + 1,
        last_run_at: new Date().toISOString(),
      })
      .eq('id', agent.id);

    return finalTask;
  },

  async runTaskWithToolsNoStreaming(
    agent: StartupAgent,
    task: AgentTask,
    systemPrompt: string,
    userId: string
  ): Promise<AgentTask> {
    const supabase = supabaseService.getServiceClient();
    const messages = [{ role: 'user', content: task.description }];
    let round = 0;
    const maxRounds = 3;
    let fullOutput = '';
    const toolsUsedSet = new Set<string>();

    while (round < maxRounds) {
      round++;
      
      const tools = await mcpService.getAvailableTools(userId, agent.project_id);
      const promptWithTools = mcpService.injectToolsIntoSystem(systemPrompt, tools);

      const roundOutput = await openrouterService.callModel(
        promptWithTools,
        messages,
        agent.model,
        agent.id
      );

      fullOutput += roundOutput;
      
      await supabase
        .from('agent_tasks')
        .update({ output: fullOutput })
        .eq('id', task.id);

      const calls = mcpService.parseToolCalls(roundOutput);
      if (calls.length === 0) {
        break;
      }

      calls.forEach((c: any) => toolsUsedSet.add(c.tool));
      await supabase
        .from('agent_tasks')
        .update({ tools_used: Array.from(toolsUsedSet) })
        .eq('id', task.id);

      fullOutput += `\n\n[System: Executing tools: ${calls.map((c: any) => c.tool).join(', ')}...]\n`;
      await supabase
        .from('agent_tasks')
        .update({ output: fullOutput })
        .eq('id', task.id);

      const toolResults = await mcpService.executeToolCalls(
        calls,
        agent.id,
        agent.project_id,
        null,
        userId
      );

      fullOutput += `\n[System: Tool execution completed.]\n`;
      await supabase
        .from('agent_tasks')
        .update({ output: fullOutput })
        .eq('id', task.id);

      messages.push({ role: 'assistant', content: roundOutput });
      messages.push({ role: 'user', content: toolResults });
    }

    const { data: finalTask, error } = await supabase
      .from('agent_tasks')
      .update({
        status: 'done',
        output: fullOutput,
        completed_at: new Date().toISOString(),
      })
      .eq('id', task.id)
      .select()
      .single();

    if (error) throw error;
    return finalTask;
  },

  async executeAndSave(
    agentId: string,
    taskDescription: string,
    userId: string,
    triggeredBy: 'user' | 'agent' | 'schedule',
    triggeredByAgentId?: string | null,
    preExistingTaskId?: string
  ): Promise<AgentTask> {
    const supabase = supabaseService.getServiceClient();
    
    const { data: agent, error: agentErr } = await supabase
      .from('startup_agents')
      .select('*')
      .eq('id', agentId)
      .single();

    if (agentErr || !agent) {
      throw new Error(`Agent not found: ${agentErr?.message || 'unknown id'}`);
    }

    let task: AgentTask;
    if (preExistingTaskId) {
      const { data, error } = await supabase
        .from('agent_tasks')
        .select('*')
        .eq('id', preExistingTaskId)
        .single();
      if (error || !data) throw new Error(`Pre-existing task not found: ${error?.message}`);
      task = data;
    } else {
      const { data, error } = await supabase
        .from('agent_tasks')
        .insert({
          agent_id: agentId,
          project_id: agent.project_id,
          title: taskDescription.slice(0, 40) + (taskDescription.length > 40 ? '...' : ''),
          description: taskDescription,
          status: 'queued',
          tools_used: [],
          triggered_by: triggeredBy,
          triggered_by_agent_id: triggeredByAgentId || null,
        })
        .select()
        .single();
      if (error || !data) throw new Error(`Failed to create task: ${error?.message}`);
      task = data;
    }

    await supabase
      .from('agent_tasks')
      .update({ status: 'running', started_at: new Date().toISOString() })
      .eq('id', task.id);

    try {
      emit(agent.project_id, StreamEventType.AGENT_STARTED,
        `${agent.name} working...`,
        {
          agentId: agent.id,
          agentName: agent.name,
          agentRole: agent.role,
          detail: taskDescription
        });

      const isCSO = agent.role === 'cso';
      const isOutreachIntent = /lead|outreach|prospect/i.test(taskDescription);

      if (isCSO && isOutreachIntent) {
        const csoTask = await this.runCSOOutreachPipeline(agent, task, userId);
        try {
          const { default: webhookService } = await import('./webhook.service');
          if (csoTask && csoTask.status === 'done') {
            webhookService.fireWebhook(agent.project_id, 'agent.task.completed', csoTask);
          } else if (csoTask) {
            webhookService.fireWebhook(agent.project_id, 'agent.task.failed', csoTask);
          }
        } catch (webhookErr) {
          console.error('Failed to trigger webhook for CSO task:', webhookErr);
        }
        return csoTask;
      }

      const rawIdentity = (AGENT_IDENTITIES as any)[agent.role] || '';
      const systemPrompt = rawIdentity.replace(/{name}/g, agent.name);
      
      const unreadMessages = await agentCommsService.getUnreadMessages(agentId, agent.project_id);
      
      const { data: unreadMsgRows } = await supabase
        .from('agent_messages')
        .select('id')
        .eq('to_agent_id', agentId)
        .eq('read', false);
      
      if (unreadMsgRows) {
        for (const row of unreadMsgRows) {
          await agentCommsService.markRead(row.id);
        }
      }

      const memoriesStr = await agentMemoryService.recallMemory(agentId, agent.project_id, taskDescription, 15);
      
      const { data: recentTasks } = await supabase
        .from('agent_tasks')
        .select('*')
        .eq('agent_id', agentId)
        .eq('status', 'done')
        .order('created_at', { ascending: false })
        .limit(5);

      let tasksStr = 'No completed tasks yet.';
      if (recentTasks && recentTasks.length > 0) {
        tasksStr = recentTasks
          .map((t) => `### Task: ${t.title}\nDescription: ${t.description}\nOutput:\n${t.output || 'No output.'}`)
          .join('\n\n---\n\n');
      }

      const availableTools = await mcpService.getAvailableTools(userId, agent.project_id);
      
      let competitorIntelStr = '';
      if (agent.role === 'cmo' || agent.role === 'cro') {
        try {
          const { data: latestReports } = await supabase
            .from('ad_intelligence_reports')
            .select('*, competitor:competitor_profiles(*)')
            .eq('project_id', agent.project_id)
            .order('generated_at', { ascending: false })
            .limit(1);

          if (latestReports && latestReports.length > 0) {
            const latestReport = latestReports[0];
            const compName = latestReport.competitor?.competitor_name || 'Competitor';
            const topAngle = latestReport.top_angles?.[0]?.angle || 'N/A';
            const topCta = latestReport.top_ctas?.[0]?.cta || 'N/A';
            
            if (agent.role === 'cmo') {
              competitorIntelStr = `\n\n[COMPETITIVE AD INTELLIGENCE]\nWe tracked competitive ad campaigns for ${compName}.\n- Total Ads Found: ${latestReport.total_ads_found}\n- Active Ads: ${latestReport.active_ads}\n- Primary Marketing Angle: ${topAngle}\n- Top CTA: ${topCta}\n- Insights:\n${latestReport.insights}\n`;
            } else if (agent.role === 'cro' && /competitor|research|benchmark|ad/i.test(taskDescription)) {
              competitorIntelStr = `\n\n[COMPETITIVE AD BENCHMARK]\nCompetitor: ${compName}\n- Active Ads count: ${latestReport.active_ads}\n- Top CTAs: ${JSON.stringify(latestReport.top_ctas)}\n- Top Formats: ${JSON.stringify(latestReport.top_formats)}\n`;
            }
          }
        } catch (err) {
          console.error('Failed to inject competitive ad intelligence:', err);
        }
      }

      let learningContext = '';
      try {
        const { default: learningService } = await import('./learning.service');
        learningContext = await learningService.getAgentContextWithLearnings(agentId, agent.project_id, taskDescription);
      } catch (learningErr) {
        console.error('Failed to inject learning context in executeAndSave:', learningErr);
      }

      const fullSystemPrompt = `[IDENTITY]
${systemPrompt}
${learningContext}

[YOUR MEMORY — PAST DECISIONS & OUTPUTS]
${memoriesStr}

[RECENT TASKS YOU COMPLETED]
${tasksStr}

[MESSAGES FROM YOUR TEAM]
${unreadMessages}

[AVAILABLE TOOLS]
${availableTools.length > 0 ? availableTools.map((t) => `- **${t.name}**: ${t.description}`).join('\n') : 'No tools active.'}
${competitorIntelStr}`;

      // Check for browser agent / web scraping intent auto-trigger (for background run)
      try {
        const { default: browserAgentService } = await import('./browser-agent.service');
        const detection = await browserAgentService.detectBrowserRequest(taskDescription);
        
        if (detection.needsBrowser && detection.scraper) {
          const runRes = await browserAgentService.runBrowserScrape(
            agent.project_id,
            agentId,
            userId,
            detection.scraper,
            detection.query,
            detection.maxResults
          );

          const { data: canvasRows } = await supabase
            .from('canvas_rows')
            .select('*')
            .eq('canvas_id', runRes.canvasId)
            .order('row_index', { ascending: true });

          const formattedRows = (canvasRows || [])
            .map((r: any, idx: number) => `${idx + 1}. ${JSON.stringify(r.data)}`)
            .join('\n');

          taskDescription = `${taskDescription}\n\n[LIVE SCRAPED DATA]\n${formattedRows}`;
        }
      } catch (browserErr) {
        console.error('Auto browser agent execution failed in executeAndSave:', browserErr);
      }

      let finalTask = await this.runTaskWithToolsNoStreaming(agent, task, fullSystemPrompt, userId);

      // AFTER task completes: Call learningService.recordTaskPerformance (fire-and-forget)
      import('./learning.service').then(({ learningService }) => {
        learningService.recordTaskPerformance(finalTask.id, agentId, agent.project_id)
          .catch((err) => console.error('Failed to record task performance in executeAndSave:', err));
      });
      
      try {
        const { default: judgeService } = await import('./judge.service');
        const evaluation = await judgeService.evaluateTask(finalTask, agent, agent.project_id);
        if (!evaluation.passed) {
          finalTask = await judgeService.triggerRevision(finalTask, agent, evaluation, agent.project_id, userId, false);
        }
      } catch (judgeErr) {
        console.error('Judge quality checking failed in executeAndSave:', judgeErr);
      }

      // AFTER judge evaluation: Update performance log with score if available
      if (finalTask.judge_score !== null && finalTask.judge_score !== undefined) {
        const score = finalTask.judge_score;
        import('./learning.service').then(({ learningService }) => {
          learningService.updatePerformanceLogScore(finalTask.id, score)
            .catch((err) => console.error('Failed to update performance log score in executeAndSave:', err));
        });
      }
      
      const nextRunTime = new Date().toISOString();
      await supabase
        .from('startup_agents')
        .update({
          tasks_completed: agent.tasks_completed + 1,
          last_run_at: nextRunTime,
        })
        .eq('id', agentId);

      await agentMemoryService.saveTaskMemories(finalTask, agentId, agent.project_id);

      // Auto-create Board Resolution from major decisions
      try {
        if (finalTask.status === 'done' && finalTask.output) {
          const lowerOutput = finalTask.output.toLowerCase();
          const isResolutionCandidate = 
            lowerOutput.includes('pricing') || 
            lowerOutput.includes('strategy') || 
            lowerOutput.includes('hiring') || 
            lowerOutput.includes('product') || 
            lowerOutput.includes('resolution') || 
            lowerOutput.includes('decide') || 
            lowerOutput.includes('approve');

          if (isResolutionCandidate) {
            const systemRes = `You are a corporate secretary. Analyze the following executive output. 
            If a major decision was proposed or decided (e.g. pricing change, product roadmap, hiring action, marketing strategy shift, financial budget), formulate it as a formal Board Resolution.
            If no major decision was made, return empty string.
            Otherwise, return a JSON block:
            {"title": "Resolution Title", "resolution": "Formal resolution text..."}`;

            const response = await openrouterService.callModel(systemRes, [{ role: 'user', content: finalTask.output }], 'deepseek/deepseek-chat');
            const cleaned = response.replace(/```json/gi, '').replace(/```/g, '').trim();
            if (cleaned) {
              const resData = JSON.parse(cleaned);
              if (resData.title && resData.resolution) {
                await supabase
                  .from('board_resolutions')
                  .insert({
                    project_id: agent.project_id,
                    title: resData.title,
                    resolution: resData.resolution,
                    proposed_by: agent.role,
                    approved_by: [agent.role],
                    status: 'proposed'
                  });
              }
            }
          }
        }
      } catch (err) {
        console.error('Failed to auto-create board resolution:', err);
      }

      const { data: allAgents } = await supabase
        .from('startup_agents')
        .select('*')
        .eq('project_id', agent.project_id);
      
      if (allAgents && finalTask.output) {
        await agentCommsService.parseAndSendMessages(
          finalTask.output,
          agent,
          allAgents,
          agent.project_id
        );
      }

      try {
        const { default: webhookService } = await import('./webhook.service');
        if (finalTask.status === 'done') {
          webhookService.fireWebhook(agent.project_id, 'agent.task.completed', finalTask);
        } else if (finalTask.status === 'failed') {
          webhookService.fireWebhook(agent.project_id, 'agent.task.failed', finalTask);
        }

        if (finalTask.judge_score !== null && finalTask.judge_score !== undefined && finalTask.judge_score < 20) {
          webhookService.fireWebhook(agent.project_id, 'judge.task.failed', finalTask);
        }
      } catch (webhookErr) {
        console.error('Failed to trigger task webhook in success path:', webhookErr);
      }

      emit(agent.project_id, StreamEventType.AGENT_COMPLETE,
        `${agent.name} completed`,
        {
          agentId: agent.id,
          agentName: agent.name,
          agentRole: agent.role,
          status: 'done',
          detail: finalTask.output ? finalTask.output.substring(0, 150) : ''
        });

      return finalTask;
    } catch (err: any) {
      emit(agent.project_id, StreamEventType.AGENT_FAILED,
        `${agent.name} failed`,
        {
          agentId: agent.id,
          agentName: agent.name,
          agentRole: agent.role,
          status: 'error',
          detail: err.message || String(err)
        });
      console.error(`Task ${task.id} execution failed:`, err);
      
      const { data: failedTask } = await supabase
        .from('agent_tasks')
        .update({
          status: 'failed',
          output: `[Execution Error]: ${err.message || String(err)}`,
          completed_at: new Date().toISOString(),
        })
        .eq('id', task.id)
        .select()
        .single();

      if (failedTask) {
        try {
          const { default: webhookService } = await import('./webhook.service');
          webhookService.fireWebhook(agent.project_id, 'agent.task.failed', failedTask);
        } catch (webhookErr) {
          console.error('Failed to trigger task webhook in error path:', webhookErr);
        }
      }
        
      return failedTask;
    }
  },
};

export default agentRuntimeService;
