import openrouterService from './openrouter.service';
import agentService from './agent.service';
import messageService from './message.service';
import projectService from './project.service';
import supabaseService from './supabase.service';
import toolsService from './tools.service';
import mcpService from './mcp.service';
import { DEFAULT_SUB_AGENT_MODEL, DEFAULT_ORCHESTRATOR_MODEL } from '../lib/constants';
import { Agent } from '../types';
import { emit } from '../lib/emit';
import { StreamEventType } from '../lib/stream-events';

function getAppUrl() {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL;
  }
  const port = process.env.PORT || '3000';
  return `http://127.0.0.1:${port}`;
}

export function extractSearchQuery(goal: string, resumeText?: string): string {
  let userQuery = goal;
  if (userQuery.includes('[Pasted Context File:')) {
    const lastTicks = userQuery.lastIndexOf('```');
    if (lastTicks !== -1) {
      userQuery = userQuery.substring(lastTicks + 3).trim();
    }
  }
  
  const combinedText = ((resumeText || '') + ' ' + userQuery).toLowerCase();
  
  let location = '';
  if (combinedText.includes('guntur')) location = 'Guntur';
  else if (combinedText.includes('bangalore') || combinedText.includes('bengaluru')) location = 'Bangalore';
  else if (combinedText.includes('hyderabad')) location = 'Hyderabad';
  else if (combinedText.includes('chennai')) location = 'Chennai';
  else if (combinedText.includes('pune')) location = 'Pune';
  else if (combinedText.includes('mumbai')) location = 'Mumbai';
  else if (combinedText.includes('delhi') || combinedText.includes('noida') || combinedText.includes('gurgaon')) location = 'Noida/Gurgaon';
  else if (combinedText.includes('andhra pradesh')) location = 'Andhra Pradesh';
  else if (combinedText.includes('india')) location = 'India';
  
  let role = '';
  if (combinedText.includes('react developer') || combinedText.includes('react.js developer')) {
    role = 'React Developer';
  } else if (combinedText.includes('frontend engineer') || combinedText.includes('frontend developer') || combinedText.includes('front-end')) {
    role = 'Frontend Engineer';
  } else if (combinedText.includes('next.js developer') || combinedText.includes('nextjs developer')) {
    role = 'Next.js Developer';
  } else if (combinedText.includes('full stack developer') || combinedText.includes('fullstack developer')) {
    role = 'Full Stack Developer';
  } else if (combinedText.includes('backend developer') || combinedText.includes('backend engineer') || combinedText.includes('back-end')) {
    role = 'Backend Engineer';
  } else if (combinedText.includes('ai engineer') || combinedText.includes('ai developer') || combinedText.includes('llm') || combinedText.includes('artificial intelligence')) {
    role = 'AI Engineer';
  } else if (combinedText.includes('cloud engineer') || combinedText.includes('aws') || combinedText.includes('cloud developer')) {
    role = 'Cloud Engineer';
  } else if (combinedText.includes('data scientist') || combinedText.includes('data analyst')) {
    role = 'Data Scientist';
  } else if (combinedText.includes('software engineer') || combinedText.includes('software developer') || combinedText.includes('sde') || combinedText.includes('computer science')) {
    role = 'Software Engineer';
  } else if (combinedText.includes('civil engineering') || combinedText.includes('civil engineer')) {
    role = 'Civil Engineer';
  } else {
    const stripped = userQuery.replace(/[^a-zA-Z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
    const words = stripped.split(' ').filter(w => !['tailor', 'resume', 'my', 'and', 'search', 'jobs', 'find', 'for', 'the', 'cv', 'of', 'in', 'at'].includes(w.toLowerCase()));
    if (words.length > 0) {
      role = words.slice(0, 4).join(' ');
    } else {
      role = 'Software Developer';
    }
  }
  
  return `${role}${location ? ' ' + location : ''}`;
}

export function extractWebSearchQuery(taskOrGoal: string): string {
  let clean = taskOrGoal;
  if (clean.includes('[Pasted Context File:')) {
    const lastTicks = clean.lastIndexOf('```');
    if (lastTicks !== -1) {
      clean = clean.substring(lastTicks + 3).trim();
    }
  }
  if (clean.length > 150) {
    const firstLine = clean.split('\n')[0];
    if (firstLine.length > 100) {
      return firstLine.slice(0, 100).trim();
    }
    return firstLine.trim();
  }
  return clean.trim() || "Web Query";
}

export const orchestratorService = {
  async executeToolAndLog(
    agentId: string,
    projectId: string,
    toolName: string,
    query: string,
    toolFn: () => Promise<string>
  ): Promise<string> {
    const cleanQuery = (query || "").replace(/[^\w\s\-\.\?]/g, '').slice(0, 50).trim();
    
    // Use proper JSON.stringify serialization to prevent JSON formatting / control character escape issues.
    const toolMsg = await messageService.saveMessage(
      agentId,
      projectId,
      'auto',
      `[TOOL_CALL] ${JSON.stringify({
        name: toolName,
        query: cleanQuery || 'Web Query',
        status: 'running',
        results: []
      })}`
    );

    try {
      const output = await toolFn();
      
      // Parse links and titles from output text
      let results: { title: string; url: string }[] = [];
      const urlRegex = /(https?:\/\/[^\s\)\"\'>]+)/g;
      
      const lines = output.split('\n');
      let currentTitle = '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('- **Title**:') || trimmed.startsWith('**Title**:')) {
          currentTitle = trimmed.substring(trimmed.indexOf('Title**:') + 8).trim();
        } else if ((trimmed.startsWith('- **Source**:') || trimmed.startsWith('**Source**:') || trimmed.startsWith('URL:') || trimmed.includes('URL:')) && currentTitle) {
          const match = trimmed.match(urlRegex);
          if (match && match[0]) {
            results.push({ title: currentTitle.replace(/[^\w\s\-\.\?]/g, ''), url: match[0] });
            currentTitle = '';
          }
        }
      }
      
      if (results.length === 0) {
        const urls = output.match(urlRegex) || [];
        const uniqueUrls = Array.from(new Set(urls));
        uniqueUrls.forEach((url, i) => {
          let domain = url;
          try {
            domain = new URL(url).hostname;
          } catch(e){}
          results.push({ title: `Resource ${i + 1} (${domain})`.replace(/[^\w\s\-\.\?]/g, ''), url });
        });
      }
      
      results = results.slice(0, 5);

      await messageService.updateMessage(
        toolMsg.id,
        `[TOOL_CALL] ${JSON.stringify({
          name: toolName,
          query: cleanQuery || 'Web Query',
          status: 'success',
          results: results
        })}`
      );

      return output;
    } catch (e) {
      console.error(`Tool execution error for ${toolName}:`, e);
      await messageService.updateMessage(
        toolMsg.id,
        `[TOOL_CALL] ${JSON.stringify({
          name: toolName,
          query: cleanQuery || 'Web Query',
          status: 'error',
          results: []
        })}`
      );
      return `[ERROR: Tool ${toolName} execution failed: ${e instanceof Error ? e.message : String(e)}]`;
    }
  },

  async planManagerAgents(
    goal: string, 
    model: string, 
    projectId?: string, 
    options?: any
  ): Promise<{ 
    intent: string; 
    complexity: string; 
    route: string; 
    councilRequired: boolean; 
    summary: string; 
    managers: { name: string; role: string; task: string }[] 
  }> {
    if (projectId) {
      emit(projectId, StreamEventType.ORCHESTRATOR_THINKING, 'Orchestrator planning your goal...');
    }
    let toolContext = "";
    try {
      const goalLower = goal.toLowerCase();
      
      const useWebSearch = options ? !!options.webSearch : (goalLower.includes("web") || goalLower.includes("search") || goalLower.includes("tavily") || goalLower.includes("internet"));
      const useExaSearch = options ? !!options.exaSearch : goalLower.includes("exa");
      const useKaggle = options ? !!options.kaggle : (goalLower.includes("kaggle") || goalLower.includes("dataset") || goalLower.includes("download data"));
      const useDatabase = options ? !!options.database : (goalLower.includes("database") || goalLower.includes("postgres") || goalLower.includes("sql") || goalLower.includes("query"));
      const useRag = options ? !!options.rag : (goalLower.includes("rag") || goalLower.includes("qdrant") || goalLower.includes("vector") || goalLower.includes("document"));
      
      let resumeText = "";
      if (projectId) {
        try {
          const project = await projectService.getProject(projectId);
          resumeText = project.master_resume || "";
        } catch (err) {
          console.error("Error loading resume context in planManagerAgents:", err);
        }
      }

      const webQuery = extractWebSearchQuery(goal);
      const jobQuery = extractSearchQuery(goal, resumeText);

      if (useWebSearch) {
        toolContext += "\n\n" + await toolsService.searchWeb(webQuery);
      }
      if (useExaSearch) {
        toolContext += "\n\n" + await toolsService.searchExa(webQuery);
      }
      if (goalLower.includes("serper") || goalLower.includes("google")) {
        toolContext += "\n\n" + await toolsService.searchSerper(webQuery);
      }
      if (goalLower.includes("pdf") || goalLower.includes("parse file") || goalLower.includes("llamaparse") || goalLower.includes("llamaindex")) {
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        const match = goal.match(urlRegex);
        const pdfUrl = match ? match[0] : "https://dummy.pdf";
        toolContext += "\n\n" + await toolsService.parsePdf(pdfUrl);
      }
      if (useRag) {
        toolContext += "\n\n" + await toolsService.searchRag(webQuery);
      }
      if (useDatabase) {
        toolContext += "\n\n" + await toolsService.queryDatabase(webQuery);
      }
      if (useKaggle) {
        toolContext += "\n\n" + await toolsService.searchKaggle(webQuery);
      }
      if (goalLower.includes("job") || goalLower.includes("jobs") || goalLower.includes("linkedin") || goalLower.includes("indeed") || goalLower.includes("tailor") || goalLower.includes("resume") || goalLower.includes("cv")) {
        toolContext += "\n\n" + await toolsService.searchJobs(jobQuery);
      }

      if (projectId && resumeText) {
        toolContext += `\n\n[USER MASTER RESUME CONTEXT]\n${resumeText}\n`;
      }
    } catch (err) {
      console.error("Error gathering root orchestrator tool context:", err);
    }

    const systemPrompt = `You are the Intent Router and Root Orchestrator of 3RDMIND.
Analyze the user's goal: "${goal}"

First, classify the intent and assess the complexity to make a routing decision:
1. "Direct Conversation" Mode:
   - For greetings (e.g. "hi", "hello", "thanks"), casual conversation, simple questions, or basic acknowledgements.
   - Set route to "Direct Conversation", complexity to "Low", councilRequired to false.
   - Place your direct, friendly, and complete response in the "summary" field.
   - Return an empty "managers" array.

2. "Specialist" Mode:
   - For writing, coding, translation, summarization, or simple focused tasks.
   - Set route to "Specialist", complexity to "Low" or "Medium", councilRequired to false.
   - Plan exactly 1 specialist manager agent in the "managers" array.

3. "Analysis" Mode:
   - For evaluations, comparisons, reviews, or lightweight research.
   - Set route to "Analysis", complexity to "Medium", councilRequired to false.
   - Plan 2 to 3 manager agents in the "managers" array.

4. "Council" Mode:
   - For strategic planning, business decisions, market research, architecture decisions, roadmaps, investment analysis, or multi-perspective reasoning.
   - Set route to "Council", complexity to "High", councilRequired to true.
   - Plan exactly 1 L2 manager agent in the "managers" array whose name ends with "Council" (e.g. "TechCouncil", "StrategyCouncil", "DesignCouncil") and whose role is "Council Chamber".

You must return your response ONLY as a raw JSON object with the following structure:
{
  "intent": "Intent classification here",
  "complexity": "Low" | "Medium" | "High",
  "route": "Direct Conversation" | "Specialist" | "Analysis" | "Council",
  "councilRequired": true | false,
  "summary": "Direct response (if Direct Conversation mode), OR a concise summary of the planned managers.",
  "managers": [
    {
      "name": "Creative name for the manager agent",
      "role": "Functional role of the manager",
      "task": "A detailed, descriptive instruction of what this manager needs to deliver."
    }
  ]
}

Respond ONLY with raw JSON. Do not include markdown code block formatting (no \`\`\`json).`;

    const userMessage = { role: 'user', content: `Goal: "${goal}"${toolContext ? `\n\nRetrieved Tool/Search Context:\n${toolContext}` : ''}` };
    const selectedModel = model || DEFAULT_ORCHESTRATOR_MODEL;

    const responseText = await openrouterService.callModel(systemPrompt, [userMessage], selectedModel);

    try {
      let cleaned = responseText.trim();
      if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```json\s*/i, '').replace(/```$/, '').trim();
      }
      const plan = JSON.parse(cleaned);
      if (projectId) {
        emit(projectId, StreamEventType.ORCHESTRATOR_PLANNING, `Planned ${plan.managers?.length || 0} agents`, {
          detail: plan.summary,
          data: { agentCount: plan.managers?.length || 0 }
        });
      }
      return plan;
    } catch (e) {
      console.error('Failed to parse manager plan JSON response:', responseText, e);
      // Fallback manager plan
      const isGreeting = ["hi", "hello", "hey", "thanks", "thank you", "proceed"].includes(goal.toLowerCase().trim());
      return {
        intent: isGreeting ? 'Greeting' : 'Strategic Planning',
        complexity: isGreeting ? 'Low' : 'High',
        route: isGreeting ? 'Direct Conversation' : 'Council',
        councilRequired: !isGreeting,
        summary: isGreeting ? 'Hello! How can I help you today?' : 'Recursive strategy to achieve the user goal.',
        managers: isGreeting ? [] : [
          {
            name: 'Strategy Council',
            role: 'Council Chamber',
            task: `Formulate a general campaign overview and strategic plan for: "${goal}"`
          }
        ]
      };
    }
  },

  async dispatchManager(managerAgent: Agent, projectId: string, selectedModel: string, options?: any): Promise<void> {
    emit(projectId, StreamEventType.ORCHESTRATOR_DISPATCHING, `Dispatching ${managerAgent.name}`, {
      agentId: managerAgent.id,
      agentName: managerAgent.name
    });
    // 1. Set manager status to running
    await agentService.updateAgentStatus(managerAgent.id, 'running');

    // Depth Guard: If depth is 3 or more, force executor mode and execute directly
    if (managerAgent.depth >= 3) {
      await this.executeManagerDirectly(managerAgent, projectId, selectedModel);
      return;
    }

    // Determine if this manager is the Root Council
    let councilRequired = false;
    try {
      const agents = await agentService.getProjectAgents(projectId);
      const orchestratorAgent = agents.find(a => a.type === 'orchestrator');
      if (orchestratorAgent && orchestratorAgent.summary) {
        const metadata = JSON.parse(orchestratorAgent.summary);
        councilRequired = !!metadata.councilRequired;
      }
    } catch (e) {
      console.warn("Failed to check councilRequired in dispatchManager:", e);
    }

    const isCouncil = councilRequired &&
                      managerAgent.depth === 2 &&
                      (managerAgent.name.toLowerCase().includes('council') ||
                       managerAgent.task?.toLowerCase().includes('council') ||
                       managerAgent.task?.toLowerCase().includes('debate'));

    // 2. Query manager to decide: executor or manager mode
    const systemPrompt = `You are ${managerAgent.name}, an L2 Manager Agent with the role: ${managerAgent.role}.
Your task is: ${managerAgent.task}

You must evaluate this task and decide:
1. "executor" mode: You can complete this task directly on your own.
2. "manager" mode: This task needs 2 to 3 L3 Executor sub-agents working in parallel to accomplish it.

Return your decision ONLY as a raw JSON object with the following format:
For executor mode:
{
  "mode": "executor",
  "result": "Your detailed direct response completing the task."
}

For manager mode:
{
  "mode": "manager",
  "agents": [
    {
      "name": "Creative name of L3 sub-agent (e.g. MarketResearcher)",
      "role": "Functional role of L3 sub-agent (e.g. Competitor Analyst)",
      "task": "A specific task for this sub-agent to execute."
    }
  ]
}

Respond ONLY with raw JSON. Do not wrap it in markdown code blocks.`;

    let decision;
    let responseText = "";

    try {
      if (isCouncil) {
        decision = {
          mode: 'manager',
          agents: [
            { name: 'Creative Seat', role: 'Creative Specialist', task: `Collaborate and propose creative strategies for: "${managerAgent.task}"` },
            { name: 'Critic Seat', role: 'Critical Analyst', task: `Collaborate and critique ideas for: "${managerAgent.task}"` },
            { name: 'Auditor Seat', role: 'Feasibility/Resource Auditor', task: `Collaborate and audit resource viability for: "${managerAgent.task}"` },
            { name: 'General Seat', role: 'General Coordinator', task: `Collaborate and align operational constraints for: "${managerAgent.task}"` }
          ]
        };
      } else {
        responseText = await openrouterService.callModel(systemPrompt, [], selectedModel, managerAgent.id);
        try {
          let cleaned = responseText.trim();
          if (cleaned.startsWith('```')) {
            cleaned = cleaned.replace(/^```json\s*/i, '').replace(/```$/, '').trim();
          }
          decision = JSON.parse(cleaned);
        } catch (e) {
          console.error('Decision parse failed, falling back to executor mode:', responseText, e);
          decision = {
            mode: 'executor',
            result: responseText
          };
        }
      }

      if (decision.mode === 'executor') {
        // Executor Mode
        const resultText = decision.result || responseText;
        await agentService.updateAgent(managerAgent.id, {
          agent_mode: 'executor',
          summary: resultText.slice(0, 500) + (resultText.length > 500 ? '...' : ''),
          status: 'done'
        });

        // Save result as assistant message in manager's chat
        await messageService.saveMessage(managerAgent.id, projectId, 'assistant', resultText);
        
        // Trigger check for root synthesis
        await this.checkAndSynthesizeRoot(projectId, selectedModel);
      } else {
        // Manager Mode - Spawn L3 Executor Agents
        const subAgentsPlanned = decision.agents || [];
        const spawnedChildren = [];
        
        const councilModels = [
          'google/gemini-2.5-pro',
          'openai/gpt-4o',
          'deepseek/deepseek-chat',
          'meta-llama/llama-3-70b-instruct'
        ];

        const customSeats = options?.councilConfig?.seats;
        const seatCount = isCouncil && customSeats ? customSeats.length : subAgentsPlanned.length;
        const enableVerdict = isCouncil && (!options || options.councilConfig?.enableVerdict !== false);

        await agentService.updateAgent(managerAgent.id, {
          agent_mode: 'manager',
          children_count: isCouncil 
            ? seatCount + (enableVerdict ? 2 : 0) // +1 for Verdict, +1 for ClaimExtractor
            : seatCount,
          children_done: 0
        });

        // Inform in chat that sub-agents are being spawned
        const spawnMsgText = isCouncil
          ? `Convening the Multi-Model AI Council debate (${seatCount} council seats). Spawning specialized model agents now.`
          : `I have analyzed the task and decided it requires ${subAgentsPlanned.length} specialist sub-agents. Spawning L3 executors now.`;

        await messageService.saveMessage(
          managerAgent.id,
          projectId,
          'assistant',
          spawnMsgText
        );

        for (let i = 0; i < seatCount; i++) {
          let name = "";
          let role = "";
          let modelForAgent = "";
          let task = "";

          if (isCouncil && customSeats) {
            const customSeat = customSeats[i];
            name = customSeat.name;
            role = customSeat.role || `${customSeat.name} Seat`;
            modelForAgent = customSeat.model;
            task = subAgentsPlanned[i]?.task || `Collaborate on the council debate for task: "${managerAgent.task}"`;
          } else {
            const childPlan = subAgentsPlanned[i];
            name = childPlan.name;
            role = childPlan.role;
            task = childPlan.task;
            modelForAgent = isCouncil
              ? councilModels[i % councilModels.length]
              : DEFAULT_SUB_AGENT_MODEL;
          }

          const childAgent = await agentService.createAgent(
            projectId,
            name,
            role,
            task,
            'subagent',
            modelForAgent,
            managerAgent.id,
            managerAgent.depth + 1, // L3 depth
            'executor',
            2000 // default budget for L3
          );
          emit(projectId, StreamEventType.ORCHESTRATOR_SPAWNING_AGENT, `Spawning ${childAgent.name}`, {
            agentName: childAgent.name,
            detail: childAgent.role,
            status: 'running'
          });
          spawnedChildren.push(childAgent);
        }

        if (isCouncil) {
          // Run sequential debate loop
          for (const child of spawnedChildren) {
            await messageService.saveMessage(
              managerAgent.id,
              projectId,
              'assistant',
              `*Council debate turn: Calling ${child.name} (${child.role}) using model ${child.model || 'Gemini'}...*`
            );
            await this.dispatchExecutor(child, managerAgent, selectedModel);
          }

          if (enableVerdict) {
            await messageService.saveMessage(
              managerAgent.id,
              projectId,
              'assistant',
              `*AI Council debate complete. Concluding with the Verdict Agent (Final Arbiter) using model OpenAI GPT-4o...*`
            );

            // Get outputs of all seats as context
            const siblings = await agentService.getAgentChildren(managerAgent.id);
            let siblingsOutput = "";
            for (const sibling of siblings) {
              if (sibling.name !== "Verdict" && sibling.status === 'done') {
                const sibMessages = await messageService.getAgentMessages(sibling.id);
                const lastAssistantResponse = sibMessages.reverse().find(m => m.role === 'assistant');
                if (lastAssistantResponse) {
                  siblingsOutput += `### Council Seat: ${sibling.name} (${sibling.role})\n`;
                  siblingsOutput += `Model used: ${sibling.model || 'Unknown'}\n`;
                  siblingsOutput += `Argument/Proposal:\n${lastAssistantResponse.content}\n\n`;
                }
              }
            }

            const verdictAgent = await agentService.createAgent(
              projectId,
              "Verdict",
              "Final Arbiter",
              "Produce the final consensus, dissent, and recommendation.",
              "subagent",
              "openai/gpt-4o",
              managerAgent.id,
              managerAgent.depth + 1,
              "executor",
              2000
            );
            emit(projectId, StreamEventType.ORCHESTRATOR_SPAWNING_AGENT, `Spawning Verdict`, {
              agentName: 'Verdict',
              detail: 'Final Arbiter',
              status: 'running'
            });

            await agentService.updateAgentStatus(verdictAgent.id, 'running');

            await messageService.saveMessage(
              verdictAgent.id,
              projectId,
              'auto',
              `TASK FOR Verdict (Final Arbiter): Synthesize debate consensus, dissent, and recommendation.`
            );

            const verdictSystemPrompt = `You are the Verdict Agent of the AI Council.
You have observed a full structured debate between expert seats. Read all their outputs.
Produce a final verdict structured exactly as:

## CONSENSUS
What all seats agree on.

## DISSENT  
Key points of disagreement between seats.

## FINAL RECOMMENDATION
Your definitive recommendation with reasoning.

## CONFIDENCE
High / Medium / Low — explain why.

Be decisive. No hedging. This is the final word.

[DEBATE HISTORY]
${siblingsOutput}`;

            const stream = openrouterService.streamModel(
              verdictSystemPrompt,
              [],
              "openai/gpt-4o",
              verdictAgent.id
            );

            const fullText = await messageService.streamAndSave(
              verdictAgent.id,
              projectId,
              stream
            );

            const summaryText = fullText.slice(0, 500) + (fullText.length > 500 ? '...' : '');
            await agentService.updateAgent(verdictAgent.id, {
              summary: summaryText,
              status: 'done'
            });

            // Increment parent done count for Verdict
            await agentService.incrementChildrenDone(managerAgent.id);

            await messageService.saveMessage(
              managerAgent.id,
              projectId,
              'assistant',
              `*AI Council Verdict completed. Concluding with the ClaimExtractor Agent (Consensus Matrix) using model OpenAI GPT-4o...*`
            );

            // Get outputs of all seats as context (including Verdict)
            const allAgents = await agentService.getAgentChildren(managerAgent.id);
            let debateOutputs = "";
            for (const ag of allAgents) {
              if (ag.status === 'done') {
                const agMessages = await messageService.getAgentMessages(ag.id);
                const lastResponse = [...agMessages].reverse().find(m => m.role === 'assistant');
                if (lastResponse) {
                  debateOutputs += `### Council Seat: ${ag.name} (${ag.role})\n`;
                  debateOutputs += `Model used: ${ag.model || 'Unknown'}\n`;
                  debateOutputs += `Argument/Proposal:\n${lastResponse.content}\n\n`;
                }
              }
            }

            const claimAgent = await agentService.createAgent(
              projectId,
              "ClaimExtractor",
              "Consensus Matrix Extractor",
              "Extract key claims and votes matrix from the council debate.",
              "subagent",
              "openai/gpt-4o",
              managerAgent.id,
              managerAgent.depth + 1,
              "executor",
              2000
            );
            emit(projectId, StreamEventType.ORCHESTRATOR_SPAWNING_AGENT, `Spawning ClaimExtractor`, {
              agentName: 'ClaimExtractor',
              detail: 'Consensus Matrix Extractor',
              status: 'running'
            });

            await agentService.updateAgentStatus(claimAgent.id, 'running');

            await messageService.saveMessage(
              claimAgent.id,
              projectId,
              'auto',
              `TASK FOR ClaimExtractor: Read all council seat outputs. Extract 5-8 key claims or decisions that were debated. For each claim, determine if each seat agreed, disagreed, or was neutral based on their output.`
            );

            const claimSystemPrompt = `You are the ClaimExtractor agent of the AI Council.
Read all council seat outputs. Extract 5-8 key claims or decisions that were debated.
For each claim, determine if each seat agreed, disagreed, or was neutral based on their output.
Return ONLY JSON in this exact format:
{
  "claims": [
    {
      "claim": "Claim description here",
      "votes": {
        "Creative": "agree" | "disagree" | "neutral",
        "Critic": "agree" | "disagree" | "neutral",
        "Auditor": "agree" | "disagree" | "neutral",
        "General": "agree" | "disagree" | "neutral",
        "Verdict": "agree" | "disagree" | "neutral"
      }
    }
  ]
}

Ensure the seat keys in the "votes" object match the active council seat names exactly (e.g. "Creative", "Critic", "Auditor", "General", "Verdict").
Do not include any explanation, text, or markdown code block wrappers. Return raw JSON text only.

[DEBATE SUMMARY & SEAT OUTPUTS]
${debateOutputs}`;

            const claimStream = openrouterService.streamModel(
              claimSystemPrompt,
              [],
              "openai/gpt-4o",
              claimAgent.id
            );

            const claimText = await messageService.streamAndSave(
              claimAgent.id,
              projectId,
              claimStream
            );

            // Clean and parse claims JSON
            let parsedClaims = [];
            try {
              const cleanedJson = claimText.replace(/```json/gi, '').replace(/```/g, '').trim();
              const parsed = JSON.parse(cleanedJson);
              parsedClaims = parsed.claims || [];
            } catch (err) {
              console.error("Failed to parse ClaimExtractor claims JSON:", err);
            }

            // Save to council_matrix table
            try {
              const supabase = supabaseService.getServiceClient();
              const { error: matrixErr } = await supabase
                .from('council_matrix')
                .insert({
                  project_id: projectId,
                  manager_id: managerAgent.id,
                  claims: parsedClaims
                });
              if (matrixErr) {
                console.error("Failed to save council matrix to DB:", matrixErr.message);
              }
            } catch (dbErr) {
              console.error("Supabase matrix save error:", dbErr);
            }

            const claimSummary = claimText.slice(0, 500) + (claimText.length > 500 ? '...' : '');
            await agentService.updateAgent(claimAgent.id, {
              summary: claimSummary,
              status: 'done'
            });

            // Increment parent done count for ClaimExtractor
            await agentService.incrementChildrenDone(managerAgent.id);

            // Trigger parent synthesis finally!
            const updatedParent = await agentService.getAgent(managerAgent.id);
            await this.synthesizeManager(updatedParent, projectId, selectedModel);
          }
        } else {
          // Run L3 executors in parallel
          await Promise.all(
            spawnedChildren.map((child) => this.dispatchExecutor(child, managerAgent, selectedModel))
          );
        }
      }
    } catch (e) {
      console.error(`Error in dispatchManager for ${managerAgent.name}:`, e);
      await agentService.updateAgentStatus(managerAgent.id, 'error');
      await messageService.saveMessage(
        managerAgent.id,
        projectId,
        'system',
        `Manager execution failed: ${e instanceof Error ? e.message : String(e)}`
      );
      await this.checkAndSynthesizeRoot(projectId, selectedModel);
    }
  },

  async executeManagerDirectly(managerAgent: Agent, projectId: string, selectedModel: string): Promise<void> {
    try {
      let toolContext = "";
      const taskLower = managerAgent.task?.toLowerCase() || "";
      
      let resumeText = "";
      try {
        const project = await projectService.getProject(projectId);
        resumeText = project.master_resume || "";
      } catch (err) {
        console.error("Error retrieving project in executeManagerDirectly:", err);
      }

      const webQuery = extractWebSearchQuery(managerAgent.task || "");
      const jobQuery = extractSearchQuery(managerAgent.task || "", resumeText);

      if (taskLower.includes("web") || taskLower.includes("search") || taskLower.includes("tavily") || taskLower.includes("internet")) {
        toolContext += "\n\n" + await this.executeToolAndLog(
          managerAgent.id,
          projectId,
          "Tavily Web Search",
          webQuery,
          () => toolsService.searchWeb(webQuery)
        );
      }
      if (taskLower.includes("exa")) {
        toolContext += "\n\n" + await this.executeToolAndLog(
          managerAgent.id,
          projectId,
          "Exa Neural Search",
          webQuery,
          () => toolsService.searchExa(webQuery)
        );
      }
      if (taskLower.includes("serper") || taskLower.includes("google")) {
        toolContext += "\n\n" + await this.executeToolAndLog(
          managerAgent.id,
          projectId,
          "Serper Google Search",
          webQuery,
          () => toolsService.searchSerper(webQuery)
        );
      }
      if (taskLower.includes("pdf") || taskLower.includes("parse file") || taskLower.includes("llamaparse") || taskLower.includes("llamaindex")) {
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        const match = managerAgent.task?.match(urlRegex);
        const pdfUrl = match ? match[0] : "https://dummy.pdf";
        toolContext += "\n\n" + await this.executeToolAndLog(
          managerAgent.id,
          projectId,
          "LlamaParse PDF Reader",
          pdfUrl,
          () => toolsService.parsePdf(pdfUrl)
        );
      }
      if (taskLower.includes("rag") || taskLower.includes("qdrant") || taskLower.includes("vector") || taskLower.includes("document")) {
        toolContext += "\n\n" + await this.executeToolAndLog(
          managerAgent.id,
          projectId,
          "Qdrant Vector RAG",
          webQuery,
          () => toolsService.searchRag(webQuery)
        );
      }
      if (taskLower.includes("database") || taskLower.includes("postgres") || taskLower.includes("sql") || taskLower.includes("query")) {
        toolContext += "\n\n" + await this.executeToolAndLog(
          managerAgent.id,
          projectId,
          "Supabase PostgreSQL Query",
          webQuery,
          () => toolsService.queryDatabase(webQuery)
        );
      }
      if (taskLower.includes("kaggle") || taskLower.includes("dataset") || taskLower.includes("download data")) {
        toolContext += "\n\n" + await this.executeToolAndLog(
          managerAgent.id,
          projectId,
          "Kaggle Dataset Search",
          webQuery,
          () => toolsService.searchKaggle(webQuery)
        );
      }
      if (taskLower.includes("job") || taskLower.includes("jobs") || taskLower.includes("linkedin") || taskLower.includes("indeed") || taskLower.includes("tailor") || taskLower.includes("resume") || taskLower.includes("cv")) {
        toolContext += "\n\n" + await this.executeToolAndLog(
          managerAgent.id,
          projectId,
          "Job Posting Search",
          jobQuery,
          () => toolsService.searchJobs(jobQuery)
        );
      }

      if (resumeText) {
        toolContext += `\n\n[USER MASTER RESUME CONTEXT]\n${resumeText}\n`;
      }

      const systemPrompt = `You are a specialized agent named ${managerAgent.name} with the role: ${managerAgent.role}.
Your task is: ${managerAgent.task}${toolContext}
Provide your detailed output directly.`;

      const responseText = await openrouterService.callModel(systemPrompt, [], selectedModel, managerAgent.id);
      await agentService.updateAgent(managerAgent.id, {
        agent_mode: 'executor',
        summary: responseText.slice(0, 500) + (responseText.length > 500 ? '...' : ''),
        status: 'done'
      });
      await messageService.saveMessage(managerAgent.id, projectId, 'assistant', responseText);
      await this.checkAndSynthesizeRoot(projectId, selectedModel);
    } catch (e) {
      console.error(`Direct manager execution failed for ${managerAgent.name}:`, e);
      await agentService.updateAgentStatus(managerAgent.id, 'error');
      await this.checkAndSynthesizeRoot(projectId, selectedModel);
    }
  },

  async dispatchExecutor(executorAgent: Agent, parentAgent: Agent, selectedModel: string): Promise<void> {
    emit(executorAgent.project_id, StreamEventType.AGENT_STARTED, `${executorAgent.name} started task`, {
      agentId: executorAgent.id,
      agentName: executorAgent.name,
      detail: executorAgent.task || undefined
    });
    await agentService.updateAgentStatus(executorAgent.id, 'running');

    // 1. Save auto task message
    await messageService.saveMessage(
      executorAgent.id,
      executorAgent.project_id,
      'auto',
      `TASK FOR ${executorAgent.name} (${executorAgent.role}): ${executorAgent.task}`
    );

    let toolContext = "";
    try {
      const taskLower = executorAgent.task?.toLowerCase() || "";
      
      let resumeText = "";
      try {
        const project = await projectService.getProject(executorAgent.project_id);
        resumeText = project.master_resume || "";
      } catch (err) {
        console.error("Error retrieving project in dispatchExecutor:", err);
      }

      const webQuery = extractWebSearchQuery(executorAgent.task || "");
      const jobQuery = extractSearchQuery(executorAgent.task || "", resumeText);

      if (taskLower.includes("web") || taskLower.includes("search") || taskLower.includes("tavily") || taskLower.includes("internet")) {
        toolContext += "\n\n" + await this.executeToolAndLog(
          executorAgent.id,
          executorAgent.project_id,
          "Tavily Web Search",
          webQuery,
          () => toolsService.searchWeb(webQuery)
        );
      }
      if (taskLower.includes("exa")) {
        toolContext += "\n\n" + await this.executeToolAndLog(
          executorAgent.id,
          executorAgent.project_id,
          "Exa Neural Search",
          webQuery,
          () => toolsService.searchExa(webQuery)
        );
      }
      if (taskLower.includes("serper") || taskLower.includes("google")) {
        toolContext += "\n\n" + await this.executeToolAndLog(
          executorAgent.id,
          executorAgent.project_id,
          "Serper Google Search",
          webQuery,
          () => toolsService.searchSerper(webQuery)
        );
      }
      if (taskLower.includes("pdf") || taskLower.includes("parse file") || taskLower.includes("llamaparse") || taskLower.includes("llamaindex")) {
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        const match = executorAgent.task?.match(urlRegex);
        const pdfUrl = match ? match[0] : "https://dummy.pdf";
        toolContext += "\n\n" + await this.executeToolAndLog(
          executorAgent.id,
          executorAgent.project_id,
          "LlamaParse PDF Reader",
          pdfUrl,
          () => toolsService.parsePdf(pdfUrl)
        );
      }
      if (taskLower.includes("rag") || taskLower.includes("qdrant") || taskLower.includes("vector") || taskLower.includes("document")) {
        toolContext += "\n\n" + await this.executeToolAndLog(
          executorAgent.id,
          executorAgent.project_id,
          "Qdrant Vector RAG",
          webQuery,
          () => toolsService.searchRag(webQuery)
        );
      }
      if (taskLower.includes("database") || taskLower.includes("postgres") || taskLower.includes("sql") || taskLower.includes("query")) {
        toolContext += "\n\n" + await this.executeToolAndLog(
          executorAgent.id,
          executorAgent.project_id,
          "Supabase PostgreSQL Query",
          webQuery,
          () => toolsService.queryDatabase(webQuery)
        );
      }
      if (taskLower.includes("kaggle") || taskLower.includes("dataset") || taskLower.includes("download data")) {
        toolContext += "\n\n" + await this.executeToolAndLog(
          executorAgent.id,
          executorAgent.project_id,
          "Kaggle Dataset Search",
          webQuery,
          () => toolsService.searchKaggle(webQuery)
        );
      }
      if (taskLower.includes("job") || taskLower.includes("jobs") || taskLower.includes("linkedin") || taskLower.includes("indeed") || taskLower.includes("tailor") || taskLower.includes("resume") || taskLower.includes("cv")) {
        toolContext += "\n\n" + await this.executeToolAndLog(
          executorAgent.id,
          executorAgent.project_id,
          "Job Posting Search",
          jobQuery,
          () => toolsService.searchJobs(jobQuery)
        );
      }

      // Retrieve project to see if there is a master resume uploaded
      try {
        const project = await projectService.getProject(executorAgent.project_id);
        if (project.master_resume) {
          toolContext += `\n\n[USER MASTER RESUME CONTEXT (Filename: ${project.master_resume_filename || 'uploaded-resume'})]\n${project.master_resume}\n`;
        }
      } catch (err) {
        console.error("Error retrieving project in dispatchExecutor:", err);
      }

      // Retrieve concurrent debate history if the parent is a council
      const parentIsCouncil = parentAgent.name.toLowerCase().includes('council') ||
                              parentAgent.task?.toLowerCase().includes('council') ||
                              parentAgent.task?.toLowerCase().includes('debate');

      const isExecutionTask = executorAgent.role === 'Execution Task' || executorAgent.name.startsWith('Task:');

      if (parentIsCouncil && isExecutionTask) {
        try {
          const siblings = await agentService.getAgentChildren(parentAgent.id);
          const verdictAgent = siblings.find(s => s.name === 'Verdict' && s.status === 'done');
          if (verdictAgent) {
            const messages = await messageService.getAgentMessages(verdictAgent.id);
            const lastAssistantResponse = messages.reverse().find(m => m.role === 'assistant');
            if (lastAssistantResponse) {
              toolContext += `\n\n[FINAL COUNCIL VERDICT]\nThe AI Council has reached consensus and delivered this verdict. Use these findings and guidelines to execute your specific task:\n\n${lastAssistantResponse.content}\n`;
            }
          }
        } catch (err) {
          console.error("Error gathering final verdict for execution task in dispatchExecutor:", err);
        }
      } else if (parentIsCouncil) {
        try {
          const siblings = await agentService.getAgentChildren(parentAgent.id);
          let siblingsOutput = "";
          for (const sibling of siblings) {
            if (sibling.id !== executorAgent.id && sibling.status === 'done') {
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
            toolContext += `\n\n[CONCURRENT COUNCIL DEBATE HISTORY]\nHere are the viewpoints and drafts submitted by other models in the council so far. Review them, critique them if necessary, and build upon or refine them to reach a consensus:\n\n${siblingsOutput}`;
          }
        } catch (err) {
          console.error("Error gathering council sibling outputs in dispatchExecutor:", err);
        }
      }
    } catch (err) {
      console.error(`Error resolving tools context for agent ${executorAgent.name}:`, err);
    }

    const systemPrompt = `You are a specialized sub-agent named ${executorAgent.name} with the role: ${executorAgent.role}.
Your current task is: ${executorAgent.task}${toolContext}

Provide your response directly. Keep it structured and high quality.`;

    try {
      // 2. Fetch available tools for this project/user context
      const availableTools = await mcpService.getAvailableTools(null, executorAgent.project_id);

      // 3. Stream results from model with tool capability
      const stream = openrouterService.streamModelWithTools(
        systemPrompt,
        [],
        executorAgent.model || DEFAULT_SUB_AGENT_MODEL,
        availableTools,
        executorAgent.id
      );

      // 4. Save stream in database incrementally
      let fullText = await messageService.streamAndSave(
        executorAgent.id,
        executorAgent.project_id,
        stream
      );

      // 5. Reactive tool calls loop check
      const toolCalls = mcpService.parseToolCalls(fullText);
      if (toolCalls.length > 0) {
        // Retrieve the assistant message we just created to get its ID
        const latestMsgs = await messageService.getAgentMessages(executorAgent.id);
        const assistantMsg = latestMsgs.reverse().find(m => m.role === 'assistant');
        const messageId = assistantMsg?.id || null;

        // Execute tool calls and save logs to DB
        const toolResultContext = await mcpService.executeToolCalls(
          toolCalls,
          executorAgent.id,
          executorAgent.project_id,
          messageId,
          null
        );

        // Save tool output log into database so it renders in user UI
        await messageService.saveMessage(
          executorAgent.id,
          executorAgent.project_id,
          'auto',
          `[MCP TOOL RESULTS INJECTED]\n${toolResultContext}`
        );

        // Fetch cumulative history for second thinking stage
        const currentMessages = await messageService.getAgentMessages(executorAgent.id);
        const chatHistory = currentMessages
          .filter(m => m.role === 'user' || m.role === 'assistant' || m.role === 'auto')
          .map(m => ({
            role: m.role === 'auto' ? 'user' : m.role,
            content: m.content
          }));

        // Stream final response based on tool execution data
        const finalStream = openrouterService.streamModel(
          systemPrompt,
          chatHistory,
          executorAgent.model || DEFAULT_SUB_AGENT_MODEL,
          executorAgent.id
        );

        fullText = await messageService.streamAndSave(
          executorAgent.id,
          executorAgent.project_id,
          finalStream
        );
      }

      // 6. Update executor summary and status
      const summaryText = fullText.slice(0, 500) + (fullText.length > 500 ? '...' : '');
      await agentService.updateAgent(executorAgent.id, {
        summary: summaryText,
        status: 'done'
      });

      // 5. Increment parent done count
      const parentDone = await agentService.incrementChildrenDone(parentAgent.id);
      
      // Retrieve parent to check children count
      const updatedParent = await agentService.getAgent(parentAgent.id);
      if (parentDone >= updatedParent.children_count) {
        // All children completed, trigger parent synthesis
        await this.synthesizeManager(updatedParent, executorAgent.project_id, selectedModel);
      }
    } catch (e) {
      console.error(`Error in dispatchExecutor for agent ${executorAgent.name}:`, e);
      await agentService.updateAgentStatus(executorAgent.id, 'error');
      await messageService.saveMessage(
        executorAgent.id,
        executorAgent.project_id,
        'system',
        `Execution failed: ${e instanceof Error ? e.message : String(e)}`
      );

      // Increment counters to prevent blocking parent completion
      const parentDone = await agentService.incrementChildrenDone(parentAgent.id);
      const updatedParent = await agentService.getAgent(parentAgent.id);
      if (parentDone >= updatedParent.children_count) {
        await this.synthesizeManager(updatedParent, executorAgent.project_id, selectedModel);
      }
    }
  },

  async synthesizeManager(managerAgent: Agent, projectId: string, selectedModel: string): Promise<string> {
    emit(projectId, StreamEventType.ORCHESTRATOR_SYNTHESIZING, 'Synthesizing all agent outputs...');
    const children = await agentService.getAgentChildren(managerAgent.id);
    
    // Determine if this manager is the Root Council
    let councilRequired = false;
    try {
      const agents = await agentService.getProjectAgents(projectId);
      const orchestratorAgent = agents.find(a => a.type === 'orchestrator');
      if (orchestratorAgent && orchestratorAgent.summary) {
        const metadata = JSON.parse(orchestratorAgent.summary);
        councilRequired = !!metadata.councilRequired;
      }
    } catch (e) {
      console.warn("Failed to check councilRequired in synthesizeManager:", e);
    }

    const isCouncil = councilRequired &&
                      managerAgent.depth === 2 &&
                      (managerAgent.name.toLowerCase().includes('council') ||
                       managerAgent.task?.toLowerCase().includes('council') ||
                       managerAgent.task?.toLowerCase().includes('debate'));

    // Stage 1: If it's a council and no execution tasks have been spawned yet, spawn them.
    if (isCouncil) {
      const executionTasks = children.filter(c => c.role === 'Execution Task' || c.name.startsWith('Task:'));
      if (executionTasks.length === 0) {
        const verdictAgent = children.find(c => c.name === 'Verdict');
        let verdictContent = "";
        if (verdictAgent) {
          const msgs = await messageService.getAgentMessages(verdictAgent.id);
          const lastResponse = msgs.reverse().find(m => m.role === 'assistant');
          verdictContent = lastResponse?.content || "";
        }

        await messageService.saveMessage(
          managerAgent.id,
          projectId,
          'assistant',
          `*AI Council Verdict reached. Generating execution tasks to implement the verdict...*`
        );

        const generateTasksPrompt = `You are the Root Council Manager.
You have just received the final consensus, dissent, and recommendations from the AI Council.
Based on the council's verdict, you must formulate exactly 2 to 3 concrete, actionable execution tasks to realize the recommendations.
Each task must be assigned to a specific specialist role and have a clear, actionable description.

You must return your response ONLY as a raw JSON object with the following structure:
{
  "tasks": [
    {
      "name": "Task: Create GTM Roadmap",
      "role": "Execution Task",
      "task": "A detailed, descriptive instruction of what this execution task must perform."
    }
  ]
}

Respond ONLY with raw JSON. Do not wrap it in markdown code blocks.`;

        const messages = [
          {
            role: 'user',
            content: `Council Verdict:\n${verdictContent}\n\nGenerate the execution tasks JSON:`
          }
        ];

        let executionTasksPlanned: { name: string; role: string; task: string }[] = [];
        try {
          const responseText = await openrouterService.callModel(generateTasksPrompt, messages, selectedModel, managerAgent.id);
          let cleaned = responseText.trim();
          if (cleaned.startsWith('```')) {
            cleaned = cleaned.replace(/^```json\s*/i, '').replace(/```$/, '').trim();
          }
          const parsed = JSON.parse(cleaned);
          executionTasksPlanned = parsed.tasks || [];
        } catch (err) {
          console.error("Failed to plan execution tasks, using fallback:", err);
          executionTasksPlanned = [
            {
              name: "Task: Design Implementation Strategy",
              role: "Execution Task",
              task: `Detail the specific action steps and implementation timeline based on the council verdict: "${verdictContent.slice(0, 200)}..."`
            },
            {
              name: "Task: Execute GTM Roadmap",
              role: "Execution Task",
              task: `Create a concrete GTM strategy and roadmap based on the council verdict: "${verdictContent.slice(0, 200)}..."`
            }
          ];
        }

        // Ensure we actually planned some tasks
        if (executionTasksPlanned.length === 0) {
          executionTasksPlanned = [
            {
              name: "Task: Action Plan Design",
              role: "Execution Task",
              task: "Detail the specific action steps and implementation roadmap based on the council verdict."
            }
          ];
        }

        // Update parent agent children_count
        await agentService.updateAgent(managerAgent.id, {
          children_count: managerAgent.children_count + executionTasksPlanned.length
        });

        await messageService.saveMessage(
          managerAgent.id,
          projectId,
          'assistant',
          `Spawning ${executionTasksPlanned.length} execution tasks based on the council's verdict.`
        );

        const spawnedTasks = [];
        for (const taskPlan of executionTasksPlanned) {
          const childAgent = await agentService.createAgent(
            projectId,
            taskPlan.name,
            "Execution Task", // Set role strictly to Execution Task
            taskPlan.task,
            'subagent',
            DEFAULT_SUB_AGENT_MODEL,
            managerAgent.id,
            managerAgent.depth + 1, // L3 depth
            'executor',
            2000
          );
          emit(projectId, StreamEventType.ORCHESTRATOR_SPAWNING_AGENT, `Spawning ${childAgent.name}`, {
            agentName: childAgent.name,
            detail: 'Execution Task',
            status: 'running'
          });
          spawnedTasks.push(childAgent);
        }

        // Dispatch in parallel
        await Promise.all(
          spawnedTasks.map(taskAgent => this.dispatchExecutor(taskAgent, managerAgent, selectedModel))
        );

        return "Spawning execution tasks";
      }
    }

    // Stage 2: Synthesis after all sub-agents (and execution tasks if applicable) are finished.
    let subOutputs = '';
    for (const child of children) {
      const messages = await messageService.getAgentMessages(child.id);
      const lastAssistantResponse = messages.reverse().find((m) => m.role === 'assistant');
      subOutputs += `### Agent: ${child.name} (${child.role})\n`;
      subOutputs += `Summary: ${child.summary || 'No summary available.'}\n`;
      subOutputs += `Output:\n${lastAssistantResponse?.content || 'No output.'}\n\n`;
    }

    let systemPrompt = "";
    let messages = [];

    if (isCouncil) {
      systemPrompt = `You are the Root Council Manager. Your debate seats, verdict agent, consensus matrix, and execution tasks have all completed.
Your original task was: ${managerAgent.task}

You must synthesize their outputs into a single, cohesive, publication-grade executive report.
The report MUST contain two main sections:
1. AI COUNCIL VERDICT (Summarizing the consensus, dissent, and final recommendations).
2. CONSTRUCTIVE IMPLEMENTATION PLAN (Integrating the results of the execution tasks into a clear roadmap).

Use beautiful markdown formatting. Keep the off-white/beige aesthetic in mind (e.g. clean structured tables, blockquotes, clear headings).`;
      messages = [
        {
          role: 'user',
          content: `All council outputs and execution task results:\n${subOutputs}\n\nProvide the final synthesized AI Council Verdict and Constructive Implementation Plan report:`
        }
      ];
    } else {
      systemPrompt = `You are ${managerAgent.name}, a Manager Agent. Your sub-agents have completed their tasks.
Your task was: ${managerAgent.task}

You must synthesize their outputs into a single, cohesive, high-quality output for your parent orchestrator.
Use beautiful markdown formatting.`;
      messages = [
        {
          role: 'user',
          content: `Sub-agent outputs:\n${subOutputs}\n\nProvide the synthesis:`
        }
      ];
    }

    // Inform manager chat that we are starting synthesis
    const tempMsg = await messageService.saveMessage(
      managerAgent.id,
      projectId,
      'assistant',
      `*Synthesizing sub-agent outputs...*`
    );

    const synthesis = await openrouterService.callModel(systemPrompt, messages, selectedModel, managerAgent.id);

    // Update message row
    const supabase = supabaseService.getServiceClient();
    await supabase
      .from('messages')
      .update({ content: synthesis })
      .eq('id', tempMsg.id);

    // Update manager summary and status
    await agentService.updateAgent(managerAgent.id, {
      summary: synthesis.slice(0, 500) + (synthesis.length > 500 ? '...' : ''),
      status: 'done'
    });

    // Check if all L2 managers are done
    await this.checkAndSynthesizeRoot(projectId, selectedModel);

    return synthesis;
  },

  async checkAndSynthesizeRoot(projectId: string, selectedModel: string): Promise<void> {
    const project = await projectService.getProject(projectId);
    const agents = await agentService.getProjectAgents(projectId);
    
    const rootOrchestrator = agents.find((a) => a.type === 'orchestrator');
    if (!rootOrchestrator) return;

    // L2 managers are depth 2 subagents
    const l2Managers = agents.filter((a) => a.depth === 2 && a.type === 'subagent');
    
    // Check if all L2 managers are done/error
    const allDone = l2Managers.every((m) => m.status === 'done' || m.status === 'error');
    if (!allDone || l2Managers.length === 0) return;

    // Prevent double synthesizing if root orchestrator is already done
    const refreshedRoot = await agentService.getAgent(rootOrchestrator.id);
    if (refreshedRoot.status === 'done') return;

    let managerSummaries = '';
    for (const manager of l2Managers) {
      const messages = await messageService.getAgentMessages(manager.id);
      const lastResponse = messages.reverse().find((m) => m.role === 'assistant');
      managerSummaries += `### Manager: ${manager.name} (${manager.role})\n`;
      managerSummaries += `Task: ${manager.task}\n`;
      managerSummaries += `Output:\n${lastResponse?.content || 'No output.'}\n\n`;

      // Gather L3 executor sub-agents under this manager
      const children = await agentService.getAgentChildren(manager.id);
      if (children && children.length > 0) {
        managerSummaries += `#### Detailed Sub-agent Deliverables under ${manager.name}:\n`;
        for (const child of children) {
          const childMessages = await messageService.getAgentMessages(child.id);
          const childResponse = childMessages.reverse().find((m) => m.role === 'assistant');
          managerSummaries += `- **Sub-agent**: ${child.name} (${child.role})\n`;
          managerSummaries += `  **Task**: ${child.task}\n`;
          managerSummaries += `  **Detailed Output**:\n${childResponse?.content || 'No output.'}\n\n`;
        }
      }
    }

    const systemPrompt = `You are 3RDMIND, the Lead Orchestrator. The AI Council, manager agents, and sub-agents have completed their tasks.
Your original goal was: "${project.goal}"

Synthesize all the outputs into a single cohesive, premium final report for the user.
If a council was run, your final report must include:
1. Executive Summary & AI Council Verdict (Consensus, Dissent, Final Recommendations).
2. Constructive Implementation Plan (Roadmap and actionable tasks completed).

Ensure that you incorporate the specific details, metrics, and deliverables from the execution tasks and sub-agents so no details are lost.
Deliver a premium, publication-grade markdown document.`;

    const messages = [
      {
        role: 'user',
        content: `Sub-agent and Manager outputs:\n${managerSummaries}\n\nSynthesize the final report:`
      }
    ];

    const tempMsg = await messageService.saveMessage(
      rootOrchestrator.id,
      projectId,
      'assistant',
      `*All manager agents have finished. Synthesizing final orchestration report...*`
    );

    const rootModel = rootOrchestrator.model || selectedModel || DEFAULT_ORCHESTRATOR_MODEL;
    const finalSynthesis = await openrouterService.callModel(systemPrompt, messages, rootModel, rootOrchestrator.id);

    // Save final report to message
    const supabase = supabaseService.getServiceClient();
    await supabase
      .from('messages')
      .update({ content: finalSynthesis })
      .eq('id', tempMsg.id);

    // Update L1 root status to done
    await agentService.updateAgentStatus(rootOrchestrator.id, 'done');
    emit(projectId, StreamEventType.ORCHESTRATOR_COMPLETE, 'All agents complete', { status: 'done' });
  },

  async runFullPipeline(goal: string, projectId: string, model: string): Promise<void> {
    try {
      const agentsList = await agentService.getProjectAgents(projectId);
      const orchestrator = agentsList.find((a) => a.type === 'orchestrator');
      if (!orchestrator) throw new Error('Orchestrator agent was not pre-spawned.');

      // Update budget for root orchestrator
      await agentService.updateAgent(orchestrator.id, { token_budget: 8000 });

      // 1. Plan L2 managers
      const plan = await this.planManagerAgents(goal, model, projectId);

      if (plan.managers && plan.managers.length > 0) {
        // Save plan message in orchestrator chat
        await messageService.saveMessage(
          orchestrator.id,
          projectId,
          'assistant',
          `**Workflow Plan Created**\n\n${plan.summary}\n\nSpawning ${plan.managers.length} L2 Manager agents.`
        );

        // 2. Spawn L2 manager agents
        const spawnedManagers = [];
        for (const managerPlan of plan.managers) {
          const managerAgent = await agentService.createAgent(
            projectId,
            managerPlan.name,
            managerPlan.role,
            managerPlan.task,
            'subagent',
            model || DEFAULT_ORCHESTRATOR_MODEL,
            orchestrator.id,
            2, // L2 Depth
            'executor', // Initially set to executor, decisions will toggle
            4000 // Manager budget
          );
          emit(projectId, StreamEventType.ORCHESTRATOR_SPAWNING_AGENT, `Spawning ${managerAgent.name}`, {
            agentName: managerAgent.name,
            detail: managerAgent.role,
            status: 'running'
          });
          spawnedManagers.push(managerAgent);
        }

        // 3. Dispatch each L2 manager agent in parallel
        await Promise.all(
          spawnedManagers.map((manager) => this.dispatchManager(manager, projectId, model))
        );
      } else {
        // No managers needed - direct response
        const supabase = supabaseService.getServiceClient();
        const { data: thinkingMsgs } = await supabase
          .from('messages')
          .select('*')
          .eq('agent_id', orchestrator.id)
          .eq('role', 'assistant')
          .order('created_at', { ascending: false })
          .limit(1);

        if (thinkingMsgs && thinkingMsgs.length > 0) {
          await supabase
            .from('messages')
            .update({ content: plan.summary })
            .eq('id', thinkingMsgs[0].id);
        } else {
          await messageService.saveMessage(
            orchestrator.id,
            projectId,
            'assistant',
            plan.summary
          );
        }
        await agentService.updateAgentStatus(orchestrator.id, 'done');
      }
    } catch (e) {
      console.error('Recursive pipeline failed:', e);
      try {
        const agents = await agentService.getProjectAgents(projectId);
        const orchestrator = agents.find((a) => a.type === 'orchestrator');
        if (orchestrator) {
          await agentService.updateAgentStatus(orchestrator.id, 'error');
          await messageService.saveMessage(
            orchestrator.id,
            projectId,
            'system',
            `Pipeline execution aborted: ${e instanceof Error ? e.message : String(e)}`
          );
        }
      } catch (innerError) {
        console.error('Failed to set pipeline error state:', innerError);
      }
    }
  },

  async planAgents(goal: string, model: string, projectId?: string): Promise<{ summary: string; agents: { name: string; role: string; task: string }[] }> {
    const systemPrompt = `You are the 3RDMIND Orchestrator. Your task is to analyze the user's goal.
If the goal is a casual conversation, a greeting, hello (e.g., "hii", "hello", "hey"), or general query that does not require spawning sub-agents or planning a project workflow, return an empty "agents" array and place your direct friendly conversational response in the "summary" field.

Otherwise, if it requires planning a workflow, plan a sequence of 2 to 4 specialized sub-agents that will work step-by-step to achieve it.

If the goal involves job searching, hiring, or tailoring a resume/CV, make sure you plan a JobSearcher agent to find suitable jobs, and a CVTailoringWriter agent to customize the master resume for the found roles.

If the user request asks for a debate, consensus, panel, or council discussion on a topic, make sure to plan a sequence of council seat sub-agents (e.g., named "CreativeSeat", "CriticSeat", "FeasibilitySeat") to debate sequentially.

You must return your response ONLY as a raw JSON object with the following structure:
{
  "summary": "Your direct response to the user (if no agents needed), OR a concise summary of how the sub-agents will work together to fulfill the goal.",
  "agents": [
    {
      "name": "Creative name for the agent (e.g. Researcher, Designer, Architect)",
      "role": "Functional role of the agent (e.g. Technical Researcher, Copywriter)",
      "task": "A detailed, descriptive instruction of what this agent needs to produce. Make it actionable."
    }
  ]
}

Do not wrap the response in markdown blocks (no \`\`\`json). Just return the JSON object directly.`;

    let resumeContext = "";
    if (projectId) {
      try {
        const project = await projectService.getProject(projectId);
        if (project.master_resume) {
          resumeContext = `\n\n[USER MASTER RESUME CONTEXT (Filename: ${project.master_resume_filename || 'uploaded-resume'})]\n${project.master_resume}\n`;
        }
      } catch (err) {
        console.error("Error fetching project in planAgents:", err);
      }
    }

    const userMessage = { role: 'user', content: `Goal: "${goal}"${resumeContext}` };
    const selectedModel = model || DEFAULT_ORCHESTRATOR_MODEL;

    const responseText = await openrouterService.callModel(systemPrompt, [userMessage], selectedModel);

    try {
      let cleaned = responseText.trim();
      if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```json\s*/i, '').replace(/```$/, '').trim();
      }
      return JSON.parse(cleaned);
    } catch (e) {
      console.error('Failed to parse agent plan JSON response:', responseText, e);
      return {
        summary: 'Sequential strategy to achieve the user goal.',
        agents: [
          {
            name: 'Researcher',
            role: 'Information gathering specialist',
            task: `Gather background info and requirements for: "${goal}"`
          },
          {
            name: 'Creator',
            role: 'Content draft developer',
            task: `Draft details and copy for: "${goal}"`
          }
        ]
      };
    }
  },

  async dispatchAgents(projectId: string, agents: Agent[], selectedModel: string): Promise<void> {
    const subAgents = agents.filter(a => a.type === 'subagent');
    for (const agent of subAgents) {
      await agentService.updateAgentStatus(agent.id, 'running');
      await messageService.saveMessage(
        agent.id,
        projectId,
        'auto',
        `TASK FOR ${agent.name} (${agent.role}): ${agent.task}`
      );

      const appUrl = getAppUrl();
      try {
        const response = await fetch(`${appUrl}/api/agent`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ agentId: agent.id, projectId })
        });

        if (response.ok && response.body) {
          const reader = response.body.getReader();
          while (true) {
            const { done } = await reader.read();
            if (done) break;
          }
        }
      } catch (err) {
        console.error(`Error dispatching agent ${agent.name}:`, err);
      }

      await agentService.updateAgentStatus(agent.id, 'done');
    }
  },

  async synthesize(projectId: string, goal: string, agents: Agent[], selectedModel: string): Promise<void> {
    const orchestrator = agents.find(a => a.type === 'orchestrator');
    if (!orchestrator) return;

    const subAgents = agents.filter(a => a.type === 'subagent');
    let subOutputs = '';
    for (const agent of subAgents) {
      const messages = await messageService.getAgentMessages(agent.id);
      const lastAssistantResponse = messages.reverse().find(m => m.role === 'assistant');
      subOutputs += `### Agent: ${agent.name} (${agent.role})\n`;
      subOutputs += `Output:\n${lastAssistantResponse?.content || 'No output.'}\n\n`;
    }

    const systemPrompt = `You are 3RDMIND, the Lead Orchestrator. The sub-agents have completed their tasks.
Your original goal was: "${goal}"

Synthesize all sub-agent outputs into a final cohesive campaign/solution report for the user.
Deliver a premium, publication-grade markdown document.`;

    const messages = [
      {
        role: 'user',
        content: `Sub-agent outputs:\n${subOutputs}\n\nSynthesize the final report:`
      }
    ];

    const tempMsg = await messageService.saveMessage(
      orchestrator.id,
      projectId,
      'assistant',
      `*All sub-agents have finished. Synthesizing final report...*`
    );

    const rootModel = orchestrator.model || selectedModel || DEFAULT_ORCHESTRATOR_MODEL;
    const finalSynthesis = await openrouterService.callModel(systemPrompt, messages, rootModel, orchestrator.id);

    const supabase = supabaseService.getServiceClient();
    await supabase
      .from('messages')
      .update({ content: finalSynthesis })
      .eq('id', tempMsg.id);

    await agentService.updateAgentStatus(orchestrator.id, 'done');
  },

  async runFullPipelineLegacy(goal: string, projectId: string, model: string): Promise<void> {
    try {
      const agentsList = await agentService.getProjectAgents(projectId);
      const orchestrator = agentsList.find(a => a.type === 'orchestrator');
      if (!orchestrator) throw new Error('Orchestrator not found');

      // 1. Plan agents
      const plan = await this.planAgents(goal, model, projectId);

      if (plan.agents && plan.agents.length > 0) {
        await messageService.saveMessage(
          orchestrator.id,
          projectId,
          'assistant',
          `**Workflow Plan Created**\n\n${plan.summary}\n\nSpawning ${plan.agents.length} specialized sub-agents.`
        );

        // 2. Spawn sub-agents
        const spawned = [];
        for (const agentPlan of plan.agents) {
          const agent = await agentService.createAgent(
            projectId,
            agentPlan.name,
            agentPlan.role,
            agentPlan.task,
            'subagent',
            model || DEFAULT_SUB_AGENT_MODEL,
            orchestrator.id,
            1, // depth 1
            'executor',
            4000
          );
          spawned.push(agent);
        }

        // 3. Dispatch sequentially
        await this.dispatchAgents(projectId, spawned, model);

        // 4. Synthesize
        const updatedAgents = await agentService.getProjectAgents(projectId);
        await this.synthesize(projectId, goal, updatedAgents, model);
      } else {
        // No agents needed - direct response
        const supabase = supabaseService.getServiceClient();
        const { data: thinkingMsgs } = await supabase
          .from('messages')
          .select('*')
          .eq('agent_id', orchestrator.id)
          .eq('role', 'assistant')
          .order('created_at', { ascending: false })
          .limit(1);

        if (thinkingMsgs && thinkingMsgs.length > 0) {
          await supabase
            .from('messages')
            .update({ content: plan.summary })
            .eq('id', thinkingMsgs[0].id);
        } else {
          await messageService.saveMessage(
            orchestrator.id,
            projectId,
            'assistant',
            plan.summary
          );
        }
        await agentService.updateAgentStatus(orchestrator.id, 'done');
      }
    } catch (e) {
      console.error('Legacy pipeline failed:', e);
      try {
        const agents = await agentService.getProjectAgents(projectId);
        const orchestrator = agents.find((a) => a.type === 'orchestrator');
        if (orchestrator) {
          await agentService.updateAgentStatus(orchestrator.id, 'error');
          await messageService.saveMessage(
            orchestrator.id,
            projectId,
            'system',
            `Pipeline execution aborted: ${e instanceof Error ? e.message : String(e)}`
          );
        }
      } catch (innerError) {
        console.error('Failed to set pipeline error state:', innerError);
      }
    }
  },

  async generateCouncilTranscript(managerId: string, projectId: string): Promise<string> {
    const manager = await agentService.getAgent(managerId);
    const project = await projectService.getProject(projectId);
    const children = await agentService.getAgentChildren(managerId);

    let markdown = `# AI Council Transcript\n`;
    markdown += `**Project:** ${project.name || 'Untitled'}\n`;
    markdown += `**Goal:** ${project.goal || 'No goal specified'}\n`;
    markdown += `**Date:** ${new Date().toLocaleString()}\n`;
    markdown += `**Council:** ${manager.name} (${manager.role})\n\n`;
    markdown += `---\n\n`;

    const seats = children.filter(c => c.name !== 'Verdict' && c.name !== 'ClaimExtractor');
    const verdictAgent = children.find(c => c.name === 'Verdict');

    for (const seat of seats) {
      const msgs = await messageService.getAgentMessages(seat.id);
      const lastResponse = msgs.reverse().find(m => m.role === 'assistant');
      markdown += `## ${seat.name} (${seat.model || 'Unknown Model'})\n`;
      markdown += `${lastResponse?.content || '*No output recorded for this seat.*'}\n\n`;
    }

    if (verdictAgent) {
      const msgs = await messageService.getAgentMessages(verdictAgent.id);
      const lastResponse = msgs.reverse().find(m => m.role === 'assistant');
      markdown += `## VERDICT (${verdictAgent.model || 'Unknown Model'})\n`;
      markdown += `${lastResponse?.content || '*No verdict output recorded.*'}\n\n`;
    } else {
      markdown += `## VERDICT\n*No verdict agent was run for this council.*\n\n`;
    }

    return markdown;
  }
};

export default orchestratorService;
