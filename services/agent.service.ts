import supabaseService from './supabase.service';
import { Agent, AgentNode, AgentStatus, AgentType } from '../types';

export const agentService = {
  async createAgent(
    projectId: string,
    name: string,
    role: string,
    task: string,
    type: AgentType,
    model?: string,
    parentAgentId: string | null = null,
    depth: number = 1,
    agentMode: 'executor' | 'manager' = 'executor',
    tokenBudget: number = 4000
  ): Promise<Agent> {
    const supabase = supabaseService.getServiceClient();
    const { data, error } = await supabase
      .from('agents')
      .insert({
        project_id: projectId,
        parent_agent_id: parentAgentId,
        name,
        role,
        task,
        type,
        status: 'pending',
        locked: type === 'subagent', // Sub-agents are locked (read-only)
        model: model || null,
        depth,
        agent_mode: agentMode,
        token_budget: tokenBudget,
        tokens_used: 0,
        children_count: 0,
        children_done: 0,
        summary: null
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create agent: ${error.message}`);
    }
    return data;
  },

  async getProjectAgents(projectId: string): Promise<Agent[]> {
    const supabase = supabaseService.getClient();
    const { data, error } = await supabase
      .from('agents')
      .select()
      .eq('project_id', projectId)
      .order('created_at', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch project agents: ${error.message}`);
    }
    return data || [];
  },

  async updateAgentStatus(agentId: string, status: AgentStatus): Promise<void> {
    const supabase = supabaseService.getServiceClient();
    const { error } = await supabase
      .from('agents')
      .update({ status })
      .eq('id', agentId);

    if (error) {
      throw new Error(`Failed to update agent status: ${error.message}`);
    }
  },

  async getAgent(agentId: string): Promise<Agent> {
    const supabase = supabaseService.getClient();
    const { data, error } = await supabase
      .from('agents')
      .select()
      .eq('id', agentId)
      .single();

    if (error) {
      throw new Error(`Failed to fetch agent: ${error.message}`);
    }
    return data;
  },

  async updateAgent(agentId: string, data: Partial<Agent>): Promise<Agent> {
    const supabase = supabaseService.getServiceClient();
    const { data: updated, error } = await supabase
      .from('agents')
      .update(data)
      .eq('id', agentId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update agent: ${error.message}`);
    }
    return updated;
  },

  async getAgentTree(projectId: string): Promise<AgentNode[]> {
    const agents = await this.getProjectAgents(projectId);
    
    const nodes: AgentNode[] = agents.map(a => ({ ...a, children: [] }));
    const tree: AgentNode[] = [];
    const nodeMap: Record<string, AgentNode> = {};
    
    for (const node of nodes) {
      nodeMap[node.id] = node;
    }

    for (const node of nodes) {
      if (node.parent_agent_id) {
        const parent = nodeMap[node.parent_agent_id];
        if (parent) {
          parent.children.push(node);
        } else {
          // If parent is missing, treat as root node
          tree.push(node);
        }
      } else {
        tree.push(node);
      }
    }

    return tree;
  },

  async getAgentChildren(parentId: string): Promise<Agent[]> {
    const supabase = supabaseService.getClient();
    const { data, error } = await supabase
      .from('agents')
      .select()
      .eq('parent_agent_id', parentId)
      .order('created_at', { ascending: true });
    
    if (error) {
      throw new Error(`Failed to fetch agent children: ${error.message}`);
    }
    return data || [];
  },

  async incrementChildrenDone(parentId: string): Promise<number> {
    const supabase = supabaseService.getServiceClient();
    const { data, error } = await supabase
      .rpc('increment_agent_children_done', { parent_id: parentId });
    
    if (error) {
      console.warn("RPC increment_agent_children_done failed, using fallback:", error);
      const { data: agent, error: fError } = await supabase
        .from('agents')
        .select('children_done')
        .eq('id', parentId)
        .single();
      if (fError) throw new Error(fError.message);
      
      const nextCount = (agent?.children_done || 0) + 1;
      await supabase
        .from('agents')
        .update({ children_done: nextCount })
        .eq('id', parentId);
      return nextCount;
    }
    return data;
  },

  async getAgentDepth(agentId: string): Promise<number> {
    const agent = await this.getAgent(agentId);
    return agent.depth;
  },

  async incrementTokensUsed(agentId: string, tokens: number): Promise<void> {
    const supabase = supabaseService.getServiceClient();
    const { error } = await supabase
      .rpc('increment_agent_tokens', { agent_id: agentId, tokens });
    
    if (error) {
      console.warn("RPC increment_agent_tokens failed, using fallback:", error);
      const { data: agent, error: fError } = await supabase
        .from('agents')
        .select('tokens_used')
        .eq('id', agentId)
        .single();
      if (fError) return;
      
      await supabase
        .from('agents')
        .update({ tokens_used: (agent?.tokens_used || 0) + tokens })
        .eq('id', agentId);
    }
  }
};

export default agentService;
