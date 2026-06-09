import projectService from '../../services/project.service';
import GalleryPageClient from './GalleryPageClient';

export const revalidate = 0;

interface GalleryPageProps {
  searchParams: Promise<{ projectId?: string }>;
}

export default async function GalleryPage({ searchParams }: GalleryPageProps) {
  const resolvedSearchParams = await searchParams;
  const projectId = resolvedSearchParams.projectId || null;
  const userId = '00000000-0000-0000-0000-000000000000';

  let allProjects: any[] = [];
  try {
    allProjects = await projectService.getUserProjects(userId);
  } catch (err) {
    console.error('Failed to load user projects server side in gallery page:', err);
  }

  return (
    <GalleryPageClient
      initialProjectId={projectId}
      allProjects={allProjects}
    />
  );
}
