import { EventEmitter } from 'events';
import supabaseService from './supabase.service';
import { StreamEvent } from '../types';

const emitters = new Map<string, EventEmitter>();
const timeouts = new Map<string, NodeJS.Timeout>();

export const streamService = {
  getEmitter(projectId: string): EventEmitter {
    let emitter = emitters.get(projectId);
    if (!emitter) {
      emitter = new EventEmitter();
      emitter.setMaxListeners(100);
      emitters.set(projectId, emitter);
    }

    // Refresh idle timeout (30 minutes)
    if (timeouts.has(projectId)) {
      clearTimeout(timeouts.get(projectId)!);
    }
    const timeout = setTimeout(() => {
      emitters.delete(projectId);
      timeouts.delete(projectId);
      console.log(`Stream emitter for project ${projectId} cleaned up due to 30m inactivity.`);
    }, 30 * 60 * 1000);
    timeouts.set(projectId, timeout);

    return emitter;
  },

  async emit(projectId: string, event: StreamEvent): Promise<void> {
    try {
      const emitter = this.getEmitter(projectId);
      emitter.emit('event', event);

      // Save to Supabase stream_events table
      const supabase = supabaseService.getServiceClient();
      const { error } = await supabase
        .from('stream_events')
        .insert({
          id: event.id,
          project_id: event.projectId,
          event_type: event.type,
          title: event.title,
          detail: event.detail || null,
          agent_id: event.agentId || null,
          agent_name: event.agentName || null,
          data: event.data || {},
          status: event.status || 'running',
          created_at: event.timestamp
        });

      if (error) {
        console.error('Failed to save stream event to Supabase:', error.message);
      }
    } catch (err) {
      console.error('Error in streamService.emit:', err);
    }
  }
};

export default streamService;
