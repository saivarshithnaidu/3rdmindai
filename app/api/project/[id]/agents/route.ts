import { NextRequest } from 'next/server';
import agentService from '../../../../../services/agent.service';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const projectId = resolvedParams.id;
    const agents = await agentService.getProjectAgents(projectId);
    return new Response(JSON.stringify(agents), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('Error fetching project agents:', e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
