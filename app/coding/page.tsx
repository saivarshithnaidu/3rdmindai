import projectService from '../../services/project.service';
import CodingPageClient from './CodingPageClient';

export const revalidate = 0;

interface CodingPageProps {
  searchParams: Promise<{ projectId?: string; sessionId?: string }>;
}

export default async function CodingPage({ searchParams }: CodingPageProps) {
  const resolvedSearchParams = await searchParams;
  const projectId = resolvedSearchParams.projectId || null;
  const sessionId = resolvedSearchParams.sessionId || null;
  const userId = '00000000-0000-0000-0000-000000000000'; // Default guest/demo user

  let allProjects: any[] = [];
  try {
    allProjects = await projectService.getUserProjects(userId);
  } catch (err) {
    console.error('Failed to load user projects server side in coding page:', err);
  }

  return (
    <CodingPageClient
      initialProjectId={projectId}
      initialSessionId={sessionId}
      allProjects={allProjects}
    />
  );
}
