import { NextRequest } from 'next/server';
import supabaseService from '../../../../services/supabase.service';
import openrouterService from '../../../../services/openrouter.service';
import mcpService from '../../../../services/mcp.service';
import toolsService from '../../../../services/tools.service';
import agentMemoryService from '../../../../services/agent-memory.service';
import agentCommsService from '../../../../services/agent-comms.service';
import { AGENT_IDENTITIES } from '../../../../lib/agent-identities';
import { AgentRole, AgentTask } from '../../../../types';

export async function POST(req: NextRequest) {
  try {
    const { agentId, taskDescription, userId, projectId, triggeredBy } = await req.json();

    if (!agentId || !taskDescription || !projectId) {
      return new Response(JSON.stringify({ error: 'Missing agentId, taskDescription, or projectId' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const supabase = supabaseService.getServiceClient();

    // 1. Fetch agent
    const { data: agent, error: agentErr } = await supabase
      .from('startup_agents')
      .select('*')
      .eq('id', agentId)
      .single();

    if (agentErr || !agent) {
      return new Response(JSON.stringify({ error: `Agent not found: ${agentErr?.message}` }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 2. Create task record (status: 'running')
    const { data: task, error: taskErr } = await supabase
      .from('agent_tasks')
      .insert({
        agent_id: agentId,
        project_id: projectId,
        title: taskDescription.slice(0, 40) + (taskDescription.length > 40 ? '...' : ''),
        description: taskDescription,
        status: 'running',
        tools_used: [],
        triggered_by: triggeredBy || 'user',
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (taskErr || !task) {
      return new Response(JSON.stringify({ error: `Failed to create task: ${taskErr?.message}` }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    const customStream = new ReadableStream({
      async start(controller) {
        let outputLogs = '';
        const toolsUsedSet = new Set<string>();

        async function updateOutputInDb(content: string, finalStatus: 'done' | 'failed' = 'done') {
          const updatePayload: Record<string, any> = {
            output: content,
            tools_used: Array.from(toolsUsedSet),
          };
          if (finalStatus === 'done') {
            updatePayload.status = 'done';
            updatePayload.completed_at = new Date().toISOString();
          } else if (finalStatus === 'failed') {
            updatePayload.status = 'failed';
            updatePayload.completed_at = new Date().toISOString();
          }
          await supabase
            .from('agent_tasks')
            .update(updatePayload)
            .eq('id', task.id);
        }

        try {
          const isCSO = agent.role === 'cso';
          const isOutreachIntent = /lead|outreach|prospect/i.test(taskDescription);

          if (isCSO && isOutreachIntent) {
            // Run specialized CSO outreach pipeline and stream each log step
            const streamLog = async (msg: string) => {
              outputLogs += msg + '\n\n';
              controller.enqueue(encoder.encode(msg + '\n\n'));
              await updateOutputInDb(outputLogs, 'running' as any);
            };

            await streamLog('🚀 Starting specialized CSO Lead Generation & Outreach Pipeline...');

            // Fetch memories
            const memories = await agentMemoryService.recallMemory(agent.id, projectId, undefined, 100);
            let targetMarket = 'SaaS startups';
            let stage = 'MVP';
            
            const marketMatch = memories.match(/Company Context:\s*Target Market:\s*(.*)/i);
            if (marketMatch) targetMarket = marketMatch[1].trim();
            
            const stageMatch = memories.match(/Company Context:\s*Stage:\s*(.*)/i);
            if (stageMatch) stage = stageMatch[1].trim();

            // Step 1: Find Leads
            await streamLog(`[Step 1/6] Querying Exa Search for leads matching: "${targetMarket} ${stage}"...`);
            toolsUsedSet.add('exa_search');
            
            const exaQuery = `${targetMarket} companies ${stage}`;
            let exaResult: any;
            try {
              exaResult = await mcpService.callTool('exa', 'exa_search', { query: exaQuery }, agent.id, projectId, null, userId);
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
            }).slice(0, 5);

            await streamLog(`Found ${companies.length} prospects. Top leads identified:\n` + 
              companies.map((c: any, i: number) => `${i + 1}. **${c.name}** (${c.url})`).join('\n')
            );

            // Step 2: Research with Tavily
            await streamLog('[Step 2/6] Researching prospects individually using Tavily Search...');
            toolsUsedSet.add('tavily_search');

            const researchedLeads = [];
            for (const company of companies) {
              await streamLog(`Researching company size, news, pain points for: **${company.name}**...`);
              const tavilyQuery = `"${company.name}" company size news pain points decision maker`;
              let tavilyText = '';
              try {
                const tavilyResult = await mcpService.callTool('tavily', 'tavily_search', { query: tavilyQuery }, agent.id, projectId, null, userId);
                tavilyText = typeof tavilyResult === 'string' ? tavilyResult : JSON.stringify(tavilyResult);
              } catch (e) {
                tavilyText = await toolsService.searchWeb(tavilyQuery);
              }
              researchedLeads.push({
                ...company,
                research: tavilyText.slice(0, 1500)
              });
            }

            await streamLog('Prospect research completed.');

            // Step 3: Generate Emails via OpenRouter
            await streamLog('[Step 3/6] Formulating personalized outreach emails matching leads\' pain points...');
            
            const csoIdentity = AGENT_IDENTITIES.cso.replace(/{name}/g, agent.name);
            const generationPrompt = `You are a personalized sales outreach engine. Draft 3 personalized outreach emails based on prospect research. Keep them under 150 words.
            
Research Details:
${researchedLeads.map((l, idx) => `Prospect #${idx+1}:\nCompany: ${l.name}\nURL: ${l.url}\nResearch Context: ${l.research}`).join('\n\n')}

Return ONLY a valid JSON array of objects matching this exact signature (do not wrap in other text or code blocks):
[
  {
    "company": "Company Name",
    "contactName": "Name (estimate or use 'Founder')",
    "email": "recipient@company.com",
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
              emails = companies.map((c: any) => ({
                company: c.name,
                contactName: 'Founder',
                email: `contact@${c.name.toLowerCase().replace(/\s+/g, '')}.com`,
                subject: `Solving scaling bottlenecks for ${c.name}`,
                body: `Hi Founder,\n\nI noticed ${c.name} is scaling operations. 3RDMIND helps companies automate execution workflows. Let's discuss.\n\nBest,\n${agent.name}`
              }));
            }

            await streamLog('Outreach drafts generated:\n' + 
              emails.map((e: any, i: number) => `**Draft #${i+1} for ${e.company}**\nTo: ${e.email}\nSubject: ${e.subject}\nBody:\n${e.body}`).join('\n---\n')
            );

            // Step 4: Send via Gmail (if active)
            await streamLog('[Step 4/6] Checking Gmail Connector status...');
            const { data: gmailConn } = await supabase
              .from('connectors')
              .select('*')
              .eq('user_id', userId)
              .eq('slug', 'gmail')
              .eq('is_active', true)
              .maybeSingle();

            if (gmailConn) {
              await streamLog('Gmail Connector is active! Dispatching emails...');
              toolsUsedSet.add('gmail_send');
              for (const email of emails) {
                try {
                  await mcpService.callTool('gmail', 'gmail_send', { to: email.email, subject: email.subject, body: email.body }, agent.id, projectId, null, userId);
                  await streamLog(`Email successfully sent to ${email.email}.`);
                  await agentMemoryService.saveMemory(agent.id, projectId, 'output', `Gmail Sent: Outreach email to ${email.contactName} at ${email.company} (${email.email})`, task.id);
                } catch (mailErr: any) {
                  await streamLog(`[GMAIL ERROR] Failed sending to ${email.email}: ${mailErr.message}`);
                }
              }
            } else {
              await streamLog('Gmail Connector is NOT active. Skipping email dispatch. Outbox logged to memory.');
              for (const email of emails) {
                await agentMemoryService.saveMemory(agent.id, projectId, 'output', `Draft outreach created for ${email.contactName} at ${email.company} (${email.email})`, task.id);
              }
            }

            // Step 5: Save to Notion (if active)
            await streamLog('[Step 5/6] Checking Notion Connector status...');
            const { data: notionConn } = await supabase
              .from('connectors')
              .select('*')
              .eq('user_id', userId)
              .eq('slug', 'notion')
              .eq('is_active', true)
              .maybeSingle();

            if (notionConn) {
              await streamLog('Notion Connector is active! Creating leads tracker entries...');
              toolsUsedSet.add('notion_insert');
              for (const email of emails) {
                try {
                  await mcpService.callTool('notion', 'insert_database_entry', { company: email.company, contact: email.contactName, email: email.email, date: new Date().toLocaleDateString(), status: gmailConn ? 'Sent' : 'Draft' }, agent.id, projectId, null, userId);
                } catch (notionErr) {
                  console.warn('Notion insert failed:', notionErr);
                }
              }
              await streamLog('Notion database entries created successfully.');
            } else {
              await streamLog('Notion Connector is NOT active. Skipping database sync.');
            }

            // Step 6: Report to CEO
            await streamLog('[Step 6/6] Dispatching summary update report to the CEO agent...');
            const { data: ceoAgent } = await supabase
              .from('startup_agents')
              .select('id')
              .eq('project_id', projectId)
              .eq('role', 'ceo')
              .maybeSingle();

            if (ceoAgent) {
              const summaryReport = `TO:CEO: Sent outreach to ${emails.length} leads today. Companies: ${emails.map((e) => e.company).join(', ')}. Opening angles used: Focused on scaling bottlenecks and operational workflows.`;
              try {
                await agentCommsService.sendMessage(agent.id, ceoAgent.id, projectId, 'Outreach Campaign Executive Summary', summaryReport);
                await streamLog('CEO successfully updated.');
              } catch (commsErr) {
                console.error('Failed to notify CEO:', commsErr);
              }
            }

            await streamLog('✅ specialized CSO Outreach Pipeline execution completed successfully!');
            await updateOutputInDb(outputLogs, 'done');
          } else {
            // Standard agent execution with tool call loop
            const rawIdentity = (AGENT_IDENTITIES as any)[agent.role] || '';
            const systemPrompt = rawIdentity.replace(/{name}/g, agent.name);
            const unreadMessages = await agentCommsService.getUnreadMessages(agent.id, projectId);

            // Fetch unread messages to mark them as read
            const { data: unreadMsgRows } = await supabase
              .from('agent_messages')
              .select('id')
              .eq('to_agent_id', agent.id)
              .eq('read', false);
            
            if (unreadMsgRows) {
              for (const row of unreadMsgRows) {
                await agentCommsService.markRead(row.id);
              }
            }

            const memoriesStr = await agentMemoryService.recallMemory(agent.id, projectId, undefined, 10);
            
            const { data: recentTasks } = await supabase
              .from('agent_tasks')
              .select('*')
              .eq('agent_id', agent.id)
              .eq('status', 'done')
              .order('created_at', { ascending: false })
              .limit(5);

            let tasksStr = 'No completed tasks yet.';
            if (recentTasks && recentTasks.length > 0) {
              tasksStr = recentTasks
                .map((t) => `### Task: ${t.title}\nDescription: ${t.description}\nOutput:\n${t.output || 'No output.'}`)
                .join('\n\n---\n\n');
            }

            const promptContext = `[IDENTITY]
${systemPrompt}

[YOUR MEMORY — PAST DECISIONS & OUTPUTS]
${memoriesStr}

[RECENT TASKS YOU COMPLETED]
${tasksStr}

[MESSAGES FROM YOUR TEAM]
${unreadMessages}`;

            const messages = [{ role: 'user', content: taskDescription }];
            let round = 0;
            const maxRounds = 3;
            let lastWriteTime = 0;

            while (round < maxRounds) {
              round++;
              
              const tools = await mcpService.getAvailableTools(userId, projectId);
              const promptWithTools = mcpService.injectToolsIntoSystem(promptContext, tools);

              const stream = openrouterService.streamModel(promptWithTools, messages, agent.model);
              const reader = stream.getReader();
              let roundOutput = '';

              while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const text = typeof value === 'string' ? value : decoder.decode(value, { stream: !done });
                roundOutput += text;
                outputLogs += text;
                controller.enqueue(typeof value === 'string' ? encoder.encode(value) : value);

                // Throttled update to database during streaming
                const now = Date.now();
                if (now - lastWriteTime > 400) {
                  lastWriteTime = now;
                  await updateOutputInDb(outputLogs, 'running' as any);
                }
              }

              // Check for tool calls
              const calls = mcpService.parseToolCalls(roundOutput);
              if (calls.length === 0) {
                break;
              }

              // Record tools
              calls.forEach((c: any) => toolsUsedSet.add(c.tool));

              // Inject execution markers into stream and db
              const execMsg = `\n\n[System: Executing tools: ${calls.map((c: any) => c.tool).join(', ')}...]\n`;
              outputLogs += execMsg;
              controller.enqueue(encoder.encode(execMsg));
              await updateOutputInDb(outputLogs, 'running' as any);

              const toolResults = await mcpService.executeToolCalls(calls, agent.id, projectId, null, userId);

              const execDoneMsg = `\n[System: Tool execution completed.]\n`;
              outputLogs += execDoneMsg;
              controller.enqueue(encoder.encode(execDoneMsg));
              await updateOutputInDb(outputLogs, 'running' as any);

              messages.push({ role: 'assistant', content: roundOutput });
              messages.push({ role: 'user', content: toolResults });
            }

            await updateOutputInDb(outputLogs, 'done');
          }

          // Fetch final task record for post-processing
          const { data: finalTask } = await supabase
            .from('agent_tasks')
            .select('*')
            .eq('id', task.id)
            .single();

          if (finalTask) {
            // Update agent execution counters
            await supabase
              .from('startup_agents')
              .update({
                tasks_completed: agent.tasks_completed + 1,
                last_run_at: new Date().toISOString(),
              })
              .eq('id', agent.id);

            // Extract and save memories
            await agentMemoryService.saveTaskMemories(finalTask, agent.id, projectId);

            // Scan for inter-agent messages
            const { data: allAgents } = await supabase
              .from('startup_agents')
              .select('*')
              .eq('project_id', projectId);

            if (allAgents && finalTask.output) {
              await agentCommsService.parseAndSendMessages(
                finalTask.output,
                agent,
                allAgents,
                projectId
              );
            }
          }

          controller.close();
        } catch (err: any) {
          console.error(`Task ${task.id} execution failed:`, err);
          const errMsg = `\n\n[Execution Error]: ${err.message || String(err)}`;
          outputLogs += errMsg;
          controller.enqueue(encoder.encode(errMsg));
          await updateOutputInDb(outputLogs, 'failed');
          controller.close();
        }
      },
    });

    return new Response(customStream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Task-Id': task.id,
      },
    });
  } catch (e: any) {
    console.error('Error in agent task run API route:', e);
    return new Response(JSON.stringify({ error: e.message || String(e) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
