import { NextRequest } from 'next/server';
import agentService from '../../../../../services/agent.service';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const agentId = resolvedParams.id;
    const { status } = await request.json();

    if (!status) {
      return new Response(JSON.stringify({ error: 'Missing status' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    await agentService.updateAgentStatus(agentId, status);
    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('Error updating agent status:', e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
