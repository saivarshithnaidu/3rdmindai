import { notFound } from 'next/navigation';
import projectService from '../../../../../services/project.service';
import AgentWorkspaceClient from './AgentWorkspaceClient';

export const revalidate = 0;

interface AgentWorkspacePageProps {
  params: Promise<{ projectId: string; agentId: string }>;
}

export default async function AgentWorkspacePage({ params }: AgentWorkspacePageProps) {
  const resolvedParams = await params;
  const projectId = resolvedParams.projectId;
  const agentId = resolvedParams.agentId;
  const userId = '00000000-0000-0000-0000-000000000000'; // Default guest/demo user

  try {
    const project = await projectService.getProject(projectId);
    if (!project) {
      return notFound();
    }

    const allProjects = await projectService.getUserProjects(userId);

    return (
      <AgentWorkspaceClient
        projectId={projectId}
        agentId={agentId}
        allProjects={allProjects}
      />
    );
  } catch (err) {
    console.error('Failed to load agent workspace server side:', err);
    return notFound();
  }
}
