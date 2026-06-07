import supabaseService from './supabase.service';
import openrouterService from './openrouter.service';
import { MemoryType, AgentMemory, AgentTask } from '../types';

export const agentMemoryService = {
  async saveMemory(
    agentId: string,
    projectId: string,
    memoryType: MemoryType,
    content: string,
    sourceTaskId?: string | null
  ): Promise<AgentMemory> {
    const supabase = supabaseService.getServiceClient();
    const { data, error } = await supabase
      .from('agent_memory')
      .insert({
        agent_id: agentId,
        project_id: projectId,
        memory_type: memoryType,
        content: content.slice(0, 500), // Safety truncation
        source_task_id: sourceTaskId || null,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to save memory: ${error.message}`);
    }

    // Generate vector embedding asynchronously (don't block task execution)
    import('./embedding.service')
      .then(({ default: embeddingService }) => {
        embeddingService.embedAndSave(data.id, data.content).catch((e) => {
          console.error(`Async embedding generation error for memory ${data.id}:`, e);
        });
      })
      .catch((err) => {
        console.error('Failed to import embedding service dynamically:', err);
      });

    return data;
  },

  async recallMemory(
    agentId: string,
    projectId: string,
    query?: string,
    limit: number = 10
  ): Promise<string> {
    if (query && query.trim().length > 0) {
      try {
        const { default: embeddingService } = await import('./embedding.service');
        const semanticMatches = await embeddingService.semanticRecall(
          agentId,
          projectId,
          query,
          limit,
          0.7
        );
        if (semanticMatches && semanticMatches.length > 0) {
          return semanticMatches
            .map(
              (m) =>
                `- [${m.memory_type.toUpperCase()}]: ${m.content} (relevance: ${Math.round(
                  m.similarity * 100
                )}%)`
            )
            .join('\n');
        }
      } catch (err) {
        console.warn('Semantic memory recall failed, falling back to keyword matching:', err);
      }
    }

    const supabase = supabaseService.getClient();
    let dbQuery = supabase
      .from('agent_memory')
      .select('*')
      .eq('agent_id', agentId)
      .eq('project_id', projectId);

    if (query) {
      dbQuery = dbQuery.ilike('content', `%${query}%`);
    }

    const { data, error } = await dbQuery
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.warn(`Failed to recall memory for agent ${agentId}:`, error.message);
      return 'No memories found.';
    }

    if (!data || data.length === 0) {
      return 'No memories recorded yet.';
    }

    return data
      .map(
        (m) =>
          `- [${m.memory_type.toUpperCase()}]: ${m.content} (Recorded: ${new Date(
            m.created_at
          ).toLocaleDateString()})`
      )
      .join('\n');
  },

  async getAgentContext(agentId: string, projectId: string): Promise<string> {
    const supabase = supabaseService.getClient();

    // 1. Fetch memories
    const memoriesStr = await this.recallMemory(agentId, projectId, undefined, 10);

    // 2. Fetch last 5 completed tasks
    const { data: tasks, error: tasksError } = await supabase
      .from('agent_tasks')
      .select('*')
      .eq('agent_id', agentId)
      .eq('status', 'done')
      .order('created_at', { ascending: false })
      .limit(5);

    let tasksStr = 'No completed tasks yet.';
    if (!tasksError && tasks && tasks.length > 0) {
      tasksStr = tasks
        .map(
          (t) =>
            `### Task: ${t.title}\nDescription: ${t.description}\nOutput:\n${t.output || 'No output.'}`
        )
        .join('\n\n---\n\n');
    }

    // 3. Fetch unread messages. First get all agents for name mapping.
    const { data: agents } = await supabase
      .from('startup_agents')
      .select('id, name, role')
      .eq('project_id', projectId);

    const agentMap: Record<string, { name: string; role: string }> = {};
    if (agents) {
      agents.forEach((a) => {
        agentMap[a.id] = { name: a.name, role: a.role };
      });
    }

    const { data: messages, error: msgsError } = await supabase
      .from('agent_messages')
      .select('*')
      .eq('to_agent_id', agentId)
      .eq('project_id', projectId)
      .eq('read', false)
      .order('created_at', { ascending: true });

    let msgsStr = 'No unread messages.';
    if (!msgsError && messages && messages.length > 0) {
      msgsStr = messages
        .map((m) => {
          const sender = agentMap[m.from_agent_id] || { name: 'Unknown', role: 'system' };
          return `From: ${sender.name} (${sender.role.toUpperCase()})\nSubject: ${m.subject}\nContent:\n${m.content}`;
        })
        .join('\n\n---\n\n');
    }

    return `[YOUR MEMORY — PAST DECISIONS & OUTPUTS]
${memoriesStr}

[RECENT TASKS YOU COMPLETED]
${tasksStr}

[MESSAGES FROM YOUR TEAM]
${msgsStr}`;
  },

  async saveTaskMemories(task: AgentTask, agentId: string, projectId: string): Promise<void> {
    if (!task.output) return;

    try {
      const systemPrompt = `You are a system memory extractor. Extract 2-3 key facts, decisions, or learnings from the task output as short memory entries. Return ONLY a valid JSON array of objects, with no other text or explanation.
      
JSON structure:
[
  {
    "type": "decision" | "fact" | "output" | "learning",
    "content": "string (max 200 chars)"
  }
]`;

      const messages = [
        {
          role: 'user',
          content: `Task Title: ${task.title}\nTask Description: ${task.description}\nTask Output:\n${task.output}`,
        },
      ];

      // Use a standard model for memory extraction
      const resultText = await openrouterService.callModel(
        systemPrompt,
        messages,
        'deepseek/deepseek-chat'
      );

      let cleanJson = resultText.trim();
      if (cleanJson.startsWith('```')) {
        cleanJson = cleanJson
          .replace(/^```json\s*/i, '')
          .replace(/```$/, '')
          .trim();
      }

      const memories = JSON.parse(cleanJson);
      if (Array.isArray(memories)) {
        for (const mem of memories) {
          if (mem.type && mem.content) {
            await this.saveMemory(agentId, projectId, mem.type, mem.content, task.id);
          }
        }
      }
    } catch (err) {
      console.error(`Failed to extract memories for task ${task.id}:`, err);
    }
  },
};

export default agentMemoryService;
