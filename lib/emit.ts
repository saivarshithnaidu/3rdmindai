import { streamService } from '../services/stream.service';
import { StreamEventType } from './stream-events';
import { randomUUID } from 'crypto';

export function emit(
  projectId: string,
  type: StreamEventType,
  title: string,
  options?: {
    agentId?: string;
    agentName?: string;
    agentRole?: string;
    detail?: string;
    data?: Record<string, unknown>;
    progress?: number;
    status?: 'running' | 'done' | 'error';
  }
) {
  // Fire-and-forget: never await and catch any failures
  try {
    const id = randomUUID();
    streamService.emit(projectId, {
      id,
      type,
      timestamp: new Date().toISOString(),
      projectId,
      title,
      status: options?.status || 'running',
      ...options
    }).catch(err => {
      console.error('Emitter fire-and-forget promise rejected:', err);
    });
  } catch (err) {
    console.error('Failed to emit stream event:', err);
  }
}
