'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '../../../components/sidebar/Sidebar';
import StartupSetup from '../../../components/startup/StartupSetup';
import StartupCommandCenter from '../../../components/startup/StartupCommandCenter';
import { Project } from '../../../types';
import supabaseService from '../../../services/supabase.service';

interface StartupPageClientProps {
  projectId: string;
  allProjects: Project[];
  initialDeployed: boolean;
}

export default function StartupPageClient({
  projectId,
  allProjects,
  initialDeployed,
}: StartupPageClientProps) {
  const router = useRouter();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [activeNavItem, setActiveNavItem] = useState('Team');
  const [hasDeployed, setHasDeployed] = useState(initialDeployed);

  // Secondary verification of deployment status on mount
  useEffect(() => {
    const checkDeployment = async () => {
      try {
        const res = await fetch(`/api/startup-agents/list?projectId=${projectId}`);
        if (res.ok) {
          const data = await res.json();
          if (data && Array.isArray(data.agents) && data.agents.length === 6) {
            setHasDeployed(true);
          }
        }
      } catch (err) {
        console.warn('Failed client verification of deployment status:', err);
      }
    };
    checkDeployment();
  }, [projectId]);

  const handleNavClick = (label: string) => {
    setActiveNavItem(label);
    if (label === 'Chats') {
      router.push(`/project/${projectId}`);
    } else if (label === 'Customize') {
      alert("Customization option coming soon!");
      setActiveNavItem('Team');
    } else if (label !== 'Team' && label !== 'Connectors' && label !== 'Price Watch') {
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

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full overflow-y-auto bg-[#F5F3EE]">
        {hasDeployed ? (
          <StartupCommandCenter projectId={projectId} />
        ) : (
          <StartupSetup
            projectId={projectId}
            onDeployComplete={() => setHasDeployed(true)}
          />
        )}
      </div>
    </div>
  );
}
