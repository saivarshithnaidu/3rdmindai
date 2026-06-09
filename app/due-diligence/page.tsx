import projectService from '../../services/project.service';
import DDPageClient from './DDPageClient';

export const revalidate = 0;

interface DDPageProps {
  searchParams: Promise<{ projectId?: string }>;
}

export default async function DDPage({ searchParams }: DDPageProps) {
  const resolvedSearchParams = await searchParams;
  const projectId = resolvedSearchParams.projectId || null;
  const userId = '00000000-0000-0000-0000-000000000000'; // Default guest/demo user

  let allProjects: any[] = [];
  try {
    allProjects = await projectService.getUserProjects(userId);
  } catch (err) {
    console.error('Failed to load user projects server side in due diligence page:', err);
  }

  return (
    <DDPageClient
      initialProjectId={projectId}
      allProjects={allProjects}
    />
  );
}
