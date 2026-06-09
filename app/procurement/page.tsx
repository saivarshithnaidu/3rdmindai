import projectService from '../../services/project.service';
import ProcurementPageClient from './ProcurementPageClient';

export const revalidate = 0;

interface ProcurementPageProps {
  searchParams: Promise<{ projectId?: string }>;
}

export default async function ProcurementPage({ searchParams }: ProcurementPageProps) {
  const resolvedSearchParams = await searchParams;
  const projectId = resolvedSearchParams.projectId || null;
  const userId = '00000000-0000-0000-0000-000000000000'; // Default guest/demo user

  let allProjects: any[] = [];
  try {
    allProjects = await projectService.getUserProjects(userId);
  } catch (err) {
    console.error('Failed to load user projects server side in procurement page:', err);
  }

  return (
    <ProcurementPageClient
      initialProjectId={projectId}
      allProjects={allProjects}
    />
  );
}
