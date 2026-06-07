import supabaseService from './supabase.service';
import { StartupAgent, AgentMessage, AgentRole } from '../types';

export const agentCommsService = {
  async sendMessage(
    fromAgentId: string,
    toAgentId: string,
    projectId: string,
    subject: string,
    content: string,
    replyTaskId?: string | null
  ): Promise<AgentMessage> {
    const supabase = supabaseService.getServiceClient();
    
    // 1. Insert message
    const { data: message, error } = await supabase
      .from('agent_messages')
      .insert({
        from_agent_id: fromAgentId,
        to_agent_id: toAgentId,
        project_id: projectId,
        subject,
        content,
        read: false,
        reply_task_id: replyTaskId || null,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to send message: ${error.message}`);
    }

    // 2. Resolve roles/names for queuing
    const { data: fromAgent } = await supabase
      .from('startup_agents')
      .select('name, role')
      .eq('id', fromAgentId)
      .single();
    
    const fromName = fromAgent?.name || 'Team';
    const fromRole = (fromAgent?.role || 'agent').toUpperCase();

    // 3. Queue task for toAgent
    try {
      // Dynamic import to avoid circular dependencies
      const { agentRuntimeService } = await import('./agent-runtime.service');
      const taskTitle = `Message from ${fromRole} (${fromName})`;
      const taskDesc = `Address message from ${fromRole} (${fromName}). Subject: "${subject}". Content: "${content}". Decide on appropriate action or response.`;
      
      await agentRuntimeService.queueTask(
        toAgentId,
        projectId,
        taskTitle,
        taskDesc,
        'agent',
        fromAgentId
      );
    } catch (queueErr) {
      console.error('Failed to auto-queue task for message recipient:', queueErr);
    }

    return message;
  },

  async getUnreadMessages(agentId: string, projectId: string): Promise<string> {
    const supabase = supabaseService.getClient();

    // Fetch agents first to map names/roles
    const { data: agents } = await supabase
      .from('startup_agents')
      .select('id, name, role')
      .eq('project_id', projectId);

    const agentMap = (agents || []).reduce((acc, a) => {
      acc[a.id] = { name: a.name, role: a.role };
      return acc;
    }, {} as Record<string, { name: string; role: string }>);

    const { data: messages, error } = await supabase
      .from('agent_messages')
      .select('*')
      .eq('to_agent_id', agentId)
      .eq('project_id', projectId)
      .eq('read', false)
      .order('created_at', { ascending: true });

    if (error || !messages || messages.length === 0) {
      return 'No unread messages.';
    }

    return messages
      .map((m) => {
        const sender = agentMap[m.from_agent_id] || { name: 'Unknown', role: 'system' };
        return `From: ${sender.name} (${sender.role.toUpperCase()})\nSubject: ${m.subject}\nContent:\n${m.content}`;
      })
      .join('\n\n---\n\n');
  },

  async markRead(messageId: string): Promise<void> {
    const supabase = supabaseService.getServiceClient();
    const { error } = await supabase
      .from('agent_messages')
      .update({ read: true })
      .eq('id', messageId);

    if (error) {
      console.warn(`Failed to mark message ${messageId} as read:`, error.message);
    }
  },

  async parseAndSendMessages(
    output: string,
    fromAgent: StartupAgent,
    allAgents: StartupAgent[],
    projectId: string
  ): Promise<void> {
    if (!output) return;

    // Matches e.g. "TO:CMO: Let's do X" or "TO:cto: please do Y"
    const regex = /TO:(CEO|CMO|CTO|CFO|CSO|CRO):\s*([\s\S]*?)(?=(?:\s*TO:(?:CEO|CMO|CTO|CFO|CSO|CRO):|$))/gi;
    const matches = [...output.matchAll(regex)];

    for (const match of matches) {
      const roleStr = match[1].toLowerCase() as AgentRole;
      const content = match[2].trim();
      if (!content) continue;

      const targetAgent = allAgents.find((a) => a.role === roleStr);
      // Ensure we don't message ourselves
      if (targetAgent && targetAgent.id !== fromAgent.id) {
        const subject = `Direct instruction from ${fromAgent.role.toUpperCase()} (${fromAgent.name})`;
        try {
          await this.sendMessage(
            fromAgent.id,
            targetAgent.id,
            projectId,
            subject,
            content
          );
          console.log(`Auto-sent message from ${fromAgent.role} to ${targetAgent.role}`);
        } catch (err) {
          console.error(`Failed to auto-send message from ${fromAgent.role} to ${targetAgent.role}:`, err);
        }
      }
    }
  },
};

export default agentCommsService;
