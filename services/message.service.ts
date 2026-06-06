import supabaseService from './supabase.service';
import { Message, MessageRole } from '../types';

export const messageService = {
  async saveMessage(
    agentId: string,
    projectId: string,
    role: MessageRole,
    content: string
  ): Promise<Message> {
    const supabase = supabaseService.getServiceClient();
    const { data, error } = await supabase
      .from('messages')
      .insert({
        agent_id: agentId,
        project_id: projectId,
        role,
        content,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to save message: ${error.message}`);
    }
    return data;
  },

  async updateMessage(
    messageId: string,
    content: string
  ): Promise<Message> {
    const supabase = supabaseService.getServiceClient();
    const { data, error } = await supabase
      .from('messages')
      .update({ content })
      .eq('id', messageId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update message: ${error.message}`);
    }
    return data;
  },

  async getAgentMessages(agentId: string): Promise<Message[]> {
    const supabase = supabaseService.getClient();
    const { data, error } = await supabase
      .from('messages')
      .select()
      .eq('agent_id', agentId)
      .order('created_at', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch agent messages: ${error.message}`);
    }
    return data || [];
  },

  async streamAndSave(
    agentId: string,
    projectId: string,
    stream: ReadableStream
  ): Promise<string> {
    const supabase = supabaseService.getServiceClient();
    
    // Create the message row initially with empty content
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

    if (initError) {
      throw new Error(`Failed to initialize stream message: ${initError.message}`);
    }

    const messageId = msg.id;
    let fullContent = '';
    const reader = stream.getReader();
    const decoder = new TextDecoder();

    let lastUpdateTime = Date.now();
    const UPDATE_INTERVAL = 150; // ms

    try {
      while (true) {
        const { done, value } = await reader.read();
        
        // Decode chunk if available
        if (value) {
          const text = typeof value === 'string' ? value : decoder.decode(value, { stream: !done });
          fullContent += text;
        }

        // Throttle updates or update on completion
        const now = Date.now();
        if (done || now - lastUpdateTime > UPDATE_INTERVAL) {
          await supabase
            .from('messages')
            .update({ content: fullContent })
            .eq('id', messageId);
          lastUpdateTime = now;
        }

        if (done) break;
      }
    } catch (e) {
      console.error('Error during streaming and saving message:', e);
      // Update with whatever we have so far
      await supabase
        .from('messages')
        .update({ content: fullContent + '\n[Stream interrupted due to error]' })
        .eq('id', messageId);
      throw e;
    }

    return fullContent;
  },
};

export default messageService;
