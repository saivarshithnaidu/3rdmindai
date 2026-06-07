import { notFound } from 'next/navigation';
import projectService from '../../../services/project.service';
import StartupPageClient from './StartupPageClient';

export const revalidate = 0;

interface StartupPageProps {
  params: Promise<{ projectId: string }>;
}

export default async function StartupPage({ params }: StartupPageProps) {
  const resolvedParams = await params;
  const projectId = resolvedParams.projectId;
  const userId = '00000000-0000-0000-0000-000000000000'; // Default guest/demo user

  try {
    const project = await projectService.getProject(projectId);
    if (!project) {
      return notFound();
    }

    const allProjects = await projectService.getUserProjects(userId);

    // Fetch startup agents to determine if already deployed
    let initialDeployed = false;
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:3000'}/api/startup-agents/list?projectId=${projectId}`, {
        cache: 'no-store'
      });
      if (res.ok) {
        const data = await res.json();
        initialDeployed = data && Array.isArray(data.agents) && data.agents.length === 6;
      }
    } catch (e) {
      // If endpoint call fails (e.g. at build time or local network), fallback
      console.warn('Failed to pre-check deployed agents count in page loader:', e);
    }

    return (
      <StartupPageClient
        projectId={projectId}
        allProjects={allProjects}
        initialDeployed={initialDeployed}
      />
    );
  } catch (err) {
    console.error('Failed to load startup page server side:', err);
    return notFound();
  }
}
