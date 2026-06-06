import { NextRequest } from 'next/server';
import projectService from '../../../../../services/project.service';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const projectId = resolvedParams.id;
    const { masterResume, filename } = await request.json();

    if (masterResume === undefined) {
      return new Response(JSON.stringify({ error: 'Missing masterResume content' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const updated = await projectService.updateProject(projectId, {
      master_resume: masterResume,
      master_resume_filename: filename || null,
    });

    return new Response(JSON.stringify({ success: true, project: updated }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('Error updating project resume:', e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const projectId = resolvedParams.id;

    const updated = await projectService.updateProject(projectId, {
      master_resume: null,
      master_resume_filename: null,
    });

    return new Response(JSON.stringify({ success: true, project: updated }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('Error deleting project resume:', e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
