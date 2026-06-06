import WorkspaceLayout from '../../../components/workspace/WorkspaceLayout';
import projectService from '../../../services/project.service';
import agentService from '../../../services/agent.service';
import { notFound } from 'next/navigation';

export const revalidate = 0;

interface ProjectPageProps {
  params: Promise<{ id: string }>;
}

export default async function ProjectPage({ params }: ProjectPageProps) {
  const resolvedParams = await params;
  const projectId = resolvedParams.id;
  const userId = '00000000-0000-0000-0000-000000000000';

  try {
    const project = await projectService.getProject(projectId);
    if (!project) {
      return notFound();
    }

    const agents = await agentService.getProjectAgents(projectId);
    const allProjects = await projectService.getUserProjects(userId);

    return (
      <WorkspaceLayout
        initialProject={project}
        initialAgents={agents}
        allProjects={allProjects}
      />
    );
  } catch (e) {
    console.error('Failed to load project workspace page:', e);
    return notFound();
  }
}
