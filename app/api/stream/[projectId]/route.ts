import { NextRequest } from 'next/server';
import supabaseService from '../../../../services/supabase.service';
import streamService from '../../../../services/stream.service';

async function getRecentStreamEvents(projectId: string, limit = 50) {
  try {
    const supabase = supabaseService.getServiceClient();
    const { data, error } = await supabase
      .from('stream_events')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: true })
      .limit(limit);

    if (error) {
      console.error('Error fetching recent stream events:', error.message);
      return [];
    }

    return (data || []).map((row: any) => ({
      id: row.id,
      projectId: row.project_id,
      type: row.event_type,
      title: row.title,
      detail: row.detail,
      agentId: row.agent_id,
      agentName: row.agent_name,
      data: row.data,
      status: row.status,
      timestamp: row.created_at
    }));
  } catch (err) {
    console.error('Failed to get recent stream events:', err);
    return [];
  }
}

export async function GET(
  req: NextRequest,
  props: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await props.params;

  if (!projectId) {
    return new Response(JSON.stringify({ error: 'Missing projectId' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        // 1. Send last 50 events for replay on connect
        const recentEvents = await getRecentStreamEvents(projectId, 50);
        recentEvents.forEach((e) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(e)}\n\n`));
        });

        // 2. Subscribe to new events
        const emitter = streamService.getEmitter(projectId);

        const onEvent = (event: any) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        };

        emitter.on('event', onEvent);

        // Keep alive ping every 15s
        const ping = setInterval(() => {
          controller.enqueue(encoder.encode(': ping\n\n'));
        }, 15000);

        // Cleanup on disconnect
        req.signal.addEventListener('abort', () => {
          clearInterval(ping);
          emitter.off('event', onEvent);
          controller.close();
        });
      } catch (err) {
        console.error('Error in SSE start stream:', err);
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
