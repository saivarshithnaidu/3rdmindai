import projectService from '../../services/project.service';
import HealthPageClient from './HealthPageClient';

export const revalidate = 0;

interface HealthPageProps {
  searchParams: Promise<{ projectId?: string }>;
}

export default async function HealthPage({ searchParams }: HealthPageProps) {
  const resolvedSearchParams = await searchParams;
  const projectId = resolvedSearchParams.projectId || null;
  const userId = '00000000-0000-0000-0000-000000000000'; // Default guest/demo user

  let allProjects: any[] = [];
  try {
    allProjects = await projectService.getUserProjects(userId);
  } catch (err) {
    console.error('Failed to load user projects server side in health page:', err);
  }

  return (
    <HealthPageClient
      initialProjectId={projectId}
      allProjects={allProjects}
    />
  );
}
