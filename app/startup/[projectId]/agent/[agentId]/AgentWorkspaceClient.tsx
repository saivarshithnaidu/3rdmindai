'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '../../../../../components/sidebar/Sidebar';
import AgentWorkspace from '../../../../../components/startup/AgentWorkspace';
import { Project } from '../../../../../types';

interface AgentWorkspaceClientProps {
  projectId: string;
  agentId: string;
  allProjects: Project[];
}

export default function AgentWorkspaceClient({
  projectId,
  agentId,
  allProjects,
}: AgentWorkspaceClientProps) {
  const router = useRouter();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [activeNavItem, setActiveNavItem] = useState('Team');

  const handleNavClick = (label: string) => {
    setActiveNavItem(label);
    if (label === 'Chats') {
      router.push(`/project/${projectId}`);
    } else if (label === 'Team') {
      router.push(`/startup/${projectId}`);
    } else if (label === 'Customize') {
      alert("Customization option coming soon!");
      setActiveNavItem('Team');
    } else {
      alert(`Navigate back to Chats page to access project level ${label}.`);
      setActiveNavItem('Team');
    }
  };

  return (
    <div className="flex w-screen h-screen overflow-hidden bg-[#FBF9F6] font-dmsans">
      {/* Left Sidebar */}
      <Sidebar
        projects={allProjects}
        activeProjectId={projectId}
        isCollapsed={isSidebarCollapsed}
        setIsCollapsed={setIsSidebarCollapsed}
        activeNavItem="Team"
        onNavClick={handleNavClick}
      />

      {/* Middle Agent Workspace Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#F5F3EE]">
        <AgentWorkspace
          agentId={agentId}
          projectId={projectId}
          allProjects={allProjects}
        />
      </div>
    </div>
  );
}
