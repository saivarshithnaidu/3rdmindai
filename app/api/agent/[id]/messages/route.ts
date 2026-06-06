import { NextRequest } from 'next/server';
import messageService from '../../../../../services/message.service';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const agentId = resolvedParams.id;
    const messages = await messageService.getAgentMessages(agentId);
    return new Response(JSON.stringify(messages), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('Error fetching agent messages:', e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const agentId = resolvedParams.id;
    const { projectId, role, content } = await request.json();

    if (!projectId || !role || !content) {
      return new Response(
        JSON.stringify({ error: 'Missing projectId, role, or content' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const message = await messageService.saveMessage(agentId, projectId, role, content);
    return new Response(JSON.stringify(message), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('Error saving agent message:', e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
