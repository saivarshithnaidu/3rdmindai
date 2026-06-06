import { NextRequest } from 'next/server';
import agentService from '../../../services/agent.service';
import projectService from '../../../services/project.service';
import openrouterService from '../../../services/openrouter.service';
import messageService from '../../../services/message.service';
import mcpService from '../../../services/mcp.service';
import supabaseService from '../../../services/supabase.service';
import { DEFAULT_SUB_AGENT_MODEL } from '../../../lib/constants';

export async function POST(req: NextRequest) {
  try {
    const { agentId, projectId, depth, tokenBudget } = await req.json();

    if (!agentId || !projectId) {
      return new Response(JSON.stringify({ error: 'Missing agentId or projectId' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Support updating depth and tokenBudget if provided
    const updateData: Record<string, any> = {};
    if (typeof depth === 'number') {
      updateData.depth = depth;
    }
    if (typeof tokenBudget === 'number') {
      updateData.token_budget = tokenBudget;
    }
    if (Object.keys(updateData).length > 0) {
      await agentService.updateAgent(agentId, updateData);
    }

    const agent = await agentService.getAgent(agentId);
    const project = await projectService.getProject(projectId);

    // Enforce token budget check before starting
    if (agent.tokens_used >= agent.token_budget) {
      return new Response("[Token budget exceeded. Response truncated.]", {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'X-Remaining-Tokens': '0',
        },
      });
    }

    let resumeContext = "";
    if (project.master_resume) {
      resumeContext = `\n\n[USER MASTER RESUME CONTEXT (Filename: ${project.master_resume_filename || 'uploaded-resume'})]\n${project.master_resume}\n`;
    }

    // Retrieve concurrent debate history if the parent is a council
    let debateHistoryContext = "";
    const isCouncil = agent.name.toLowerCase().includes('council') || 
                      agent.role.toLowerCase().includes('council') ||
                      agent.task?.toLowerCase().includes('council') ||
                      agent.task?.toLowerCase().includes('debate');

    if (agent.parent_agent_id) {
      try {
        const parentAgent = await agentService.getAgent(agent.parent_agent_id);
        const parentIsCouncil = parentAgent.name.toLowerCase().includes('council') ||
                                parentAgent.task?.toLowerCase().includes('council') ||
                                parentAgent.task?.toLowerCase().includes('debate');
        
        if (parentIsCouncil || isCouncil) {
          const siblings = await agentService.getAgentChildren(agent.parent_agent_id);
          let siblingsOutput = "";
          for (const sibling of siblings) {
            if (sibling.id !== agent.id && sibling.status === 'done') {
              const sibMessages = await messageService.getAgentMessages(sibling.id);
              const lastAssistantResponse = sibMessages.reverse().find(m => m.role === 'assistant');
              if (lastAssistantResponse) {
                siblingsOutput += `### Sibling Council Seat: ${sibling.name} (${sibling.role})\n`;
                siblingsOutput += `Model used: ${sibling.model || 'Unknown'}\n`;
                siblingsOutput += `Argument/Proposal:\n${lastAssistantResponse.content}\n\n`;
              }
            }
          }
          if (siblingsOutput) {
            debateHistoryContext = `\n\n[CONCURRENT COUNCIL DEBATE HISTORY]\nHere are the viewpoints and drafts submitted by other models in the council so far. Review them, critique them if necessary, and build upon or refine them to reach a consensus:\n\n${siblingsOutput}`;
          }
        }
      } catch (err) {
        console.error("Error gathering council sibling outputs in API route:", err);
      }
    }

    const systemPrompt = `You are a specialized sub-agent named ${agent.name} with the role of ${agent.role}.
Your current task is: ${agent.task}${resumeContext}${debateHistoryContext}

You are part of a larger team of agents coordinating to achieve the goal: "${project.goal}"

Perform your task to the absolute best of your ability. Keep your output highly structured, focused, and professional. Use markdown formatting where appropriate.
Respond with your task output directly.`;

    const model = agent.model || DEFAULT_SUB_AGENT_MODEL;

    // Use a custom ReadableStream to coordinate multi-turn generations with tools
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    const customStream = new ReadableStream({
      async start(controller) {
        try {
          // 1. Fetch active tools
          const availableTools = await mcpService.getAvailableTools(null, projectId);

          // 2. Call OpenRouter with tool instructions
          const stream = openrouterService.streamModelWithTools(
            systemPrompt,
            [],
            model,
            availableTools,
            agentId
          );

          const reader = stream.getReader();
          let fullText = "";
          const supabase = supabaseService.getServiceClient();

          // Initialize first message block
          const { data: msg, error: initError } = await supabase
            .from('messages')
            .insert({
              agent_id: agentId,
              project_id: projectId,
              role: 'assistant',
              content: '',
            })
            .select()
            .single();

          if (initError) throw initError;
          const messageId = msg.id;

          let lastUpdateTime = Date.now();
          const UPDATE_INTERVAL = 150;

          while (true) {
            const { done, value } = await reader.read();
            if (value) {
              const text = typeof value === 'string' ? value : decoder.decode(value, { stream: !done });
              fullText += text;
              controller.enqueue(typeof value === 'string' ? encoder.encode(value) : value);
            }

            const now = Date.now();
            if (done || now - lastUpdateTime > UPDATE_INTERVAL) {
              await supabase
                .from('messages')
                .update({ content: fullText })
                .eq('id', messageId);
              lastUpdateTime = now;
            }

            if (done) break;
          }

          // 3. Check for tool calls inside generated block
          const toolCalls = mcpService.parseToolCalls(fullText);
          if (toolCalls.length > 0) {
            // Execute tool calls and insert logs
            const toolResultContext = await mcpService.executeToolCalls(
              toolCalls,
              agentId,
              projectId,
              messageId
            );

            const toolResultsMsg = `\n[MCP TOOL RESULTS INJECTED]\n${toolResultContext}`;
            await messageService.saveMessage(
              agentId,
              projectId,
              'auto',
              toolResultsMsg
            );

            // Stream injected indicator chunk
            controller.enqueue(encoder.encode(toolResultsMsg));

            // Fetch history for second stage thinking
            const currentMessages = await messageService.getAgentMessages(agentId);
            const chatHistory = currentMessages
              .filter(m => m.role === 'user' || m.role === 'assistant' || m.role === 'auto')
              .map(m => ({
                role: m.role === 'auto' ? 'user' : m.role,
                content: m.content
              }));

            // Call final stream
            const finalStream = openrouterService.streamModel(
              systemPrompt,
              chatHistory,
              model,
              agentId
            );

            // Initialize final assistant message block
            const { data: finalMsg, error: finalInitError } = await supabase
              .from('messages')
              .insert({
                agent_id: agentId,
                project_id: projectId,
                role: 'assistant',
                content: '',
              })
              .select()
              .single();

            if (finalInitError) throw finalInitError;
            const finalMessageId = finalMsg.id;

            const finalReader = finalStream.getReader();
            let finalFullText = "";
            lastUpdateTime = Date.now();

            while (true) {
              const { done, value } = await finalReader.read();
              if (value) {
                const text = typeof value === 'string' ? value : decoder.decode(value, { stream: !done });
                finalFullText += text;
                controller.enqueue(typeof value === 'string' ? encoder.encode(value) : value);
              }

              const now = Date.now();
              if (done || now - lastUpdateTime > UPDATE_INTERVAL) {
                await supabase
                  .from('messages')
                  .update({ content: finalFullText })
                  .eq('id', finalMessageId);
                lastUpdateTime = now;
              }

              if (done) break;
            }
          }

          controller.close();
        } catch (err) {
          console.error("Error in custom stream execution:", err);
          controller.error(err);
        }
      }
    });

    const remainingTokens = Math.max(0, agent.token_budget - agent.tokens_used);

    return new Response(customStream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Remaining-Tokens': String(remainingTokens),
      },
    });
  } catch (e) {
    console.error('Error in agent dispatch API route:', e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}


