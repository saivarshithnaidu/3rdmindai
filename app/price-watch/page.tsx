import projectService from '../../services/project.service';
import PriceWatchPageClient from './PriceWatchPageClient';

export const revalidate = 0;

interface PriceWatchPageProps {
  searchParams: Promise<{ projectId?: string }>;
}

export default async function PriceWatchPage({ searchParams }: PriceWatchPageProps) {
  const resolvedSearchParams = await searchParams;
  const projectId = resolvedSearchParams.projectId || null;
  const userId = '00000000-0000-0000-0000-000000000000'; // Default guest/demo user

  let allProjects: any[] = [];
  try {
    allProjects = await projectService.getUserProjects(userId);
  } catch (err) {
    console.error('Failed to load user projects server side in price watch page:', err);
  }

  return (
    <PriceWatchPageClient
      initialProjectId={projectId}
      allProjects={allProjects}
    />
  );
}
