import { NextRequest } from 'next/server';
import projectService from '../../../services/project.service';
import orchestratorService from '../../../services/orchestrator.service';

export async function POST(req: NextRequest) {
  try {
    const { goal, model } = await req.json();

    if (!goal) {
      return new Response(JSON.stringify({ error: 'Missing goal' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 1. Create the project in the database
    const project = await projectService.createProject(goal);

    // 2. Start the legacy flat sequential pipeline in the background asynchronously
    orchestratorService.runFullPipelineLegacy(goal, project.id, model).catch((err) => {
      console.error(`Error in runFullPipelineLegacy for project ${project.id}:`, err);
    });

    // 3. Respond immediately with the project metadata
    return new Response(JSON.stringify(project), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('Error creating project:', e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
