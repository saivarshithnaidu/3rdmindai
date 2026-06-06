import supabaseService from './supabase.service';
import agentService from './agent.service';
import messageService from './message.service';
import { DEFAULT_ORCHESTRATOR_MODEL } from '../lib/constants';
import { Project } from '../types';

export const projectService = {
  async createProject(goal: string, userId?: string | null): Promise<Project> {
    const supabase = supabaseService.getServiceClient();
    
    // Generate a default project name from goal
    let name = goal.trim().split('\n')[0];
    if (name.length > 25) {
      name = name.slice(0, 25) + '...';
    }
    if (!name) {
      name = 'Untitled Project';
    }
    
    const { data: project, error } = await supabase
      .from('projects')
      .insert({
        goal,
        name,
        user_id: userId || '00000000-0000-0000-0000-000000000000',
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create project: ${error.message}`);
    }

    try {
      // Synchronously pre-spawn the orchestrator agent so it's ready immediately
      const orchestrator = await agentService.createAgent(
        project.id,
        '3RDMIND',
        'Orchestrator',
        goal,
        'orchestrator',
        DEFAULT_ORCHESTRATOR_MODEL
      );
      
      // Update its status to running
      await agentService.updateAgentStatus(orchestrator.id, 'running');

      // Save user's prompt as the first message
      await messageService.saveMessage(orchestrator.id, project.id, 'user', goal);

      // Save initial orchestrator status message
      await messageService.saveMessage(
        orchestrator.id,
        project.id,
        'assistant',
        '*Thinking... Planning specialized sub-agents to achieve your goal.*'
      );
    } catch (e) {
      console.error('Failed to pre-spawn orchestrator agent:', e);
    }

    return project;
  },

  async getProject(id: string): Promise<Project> {
    const supabase = supabaseService.getClient();
    const { data, error } = await supabase
      .from('projects')
      .select()
      .eq('id', id)
      .single();

    if (error) {
      throw new Error(`Failed to fetch project: ${error.message}`);
    }
    return data;
  },

  async getUserProjects(userId: string): Promise<Project[]> {
    const supabase = supabaseService.getClient();
    const { data, error } = await supabase
      .from('projects')
      .select()
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch user projects: ${error.message}`);
    }
    return data || [];
  },

  async updateProject(id: string, data: Partial<Project>): Promise<Project> {
    const supabase = supabaseService.getServiceClient();
    const { data: updated, error } = await supabase
      .from('projects')
      .update(data)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update project: ${error.message}`);
    }
    return updated;
  },
};

export default projectService;
