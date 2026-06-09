import projectService from '../../services/project.service';
import AdIntelPageClient from './AdIntelPageClient';

export const revalidate = 0;

interface AdIntelPageProps {
  searchParams: Promise<{ projectId?: string }>;
}

export default async function AdIntelPage({ searchParams }: AdIntelPageProps) {
  const resolvedSearchParams = await searchParams;
  const projectId = resolvedSearchParams.projectId || null;
  const userId = '00000000-0000-0000-0000-000000000000'; // Default guest/demo user

  let allProjects: any[] = [];
  try {
    allProjects = await projectService.getUserProjects(userId);
  } catch (err) {
    console.error('Failed to load user projects server side in ad-intel page:', err);
  }

  return (
    <AdIntelPageClient
      initialProjectId={projectId}
      allProjects={allProjects}
    />
  );
}
