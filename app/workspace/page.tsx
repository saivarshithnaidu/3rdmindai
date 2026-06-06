import HomeClient from '../HomeClient';
import projectService from '../../services/project.service';
import { Project } from '../../types';

export const revalidate = 0;

export default async function WorkspaceHome() {
  const userId = '00000000-0000-0000-0000-000000000000';
  let projects: Project[] = [];

  try {
    projects = await projectService.getUserProjects(userId);
  } catch (e) {
    console.error('Error fetching user projects on page render:', e);
  }

  return <HomeClient initialProjects={projects} />;
}
