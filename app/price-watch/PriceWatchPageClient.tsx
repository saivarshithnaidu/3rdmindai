'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Sidebar from '../../components/sidebar/Sidebar';
import PriceWatchDashboard from '../../components/startup/PriceWatchDashboard';
import { Project } from '../../types';

interface PriceWatchPageClientProps {
  initialProjectId: string | null;
  allProjects: Project[];
}

export default function PriceWatchPageClient({
  initialProjectId,
  allProjects,
}: PriceWatchPageClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(initialProjectId);

  // Sync active project with URL search params
  useEffect(() => {
    const urlProj = searchParams.get('projectId');
    setActiveProjectId(urlProj);
  }, [searchParams]);

  const handleNavClick = (label: string) => {
    if (label === 'Chats') {
      if (activeProjectId) {
        router.push(`/project/${activeProjectId}`);
      } else {
        router.push('/workspace');
      }
    } else if (label === 'Team') {
      if (activeProjectId) {
        router.push(`/startup/${activeProjectId}`);
      } else {
        router.push('/workspace');
      }
    } else if (label === 'Customize') {
      alert("Customization option coming soon!");
    }
  };

  const handleProjectSelect = (projId: string | null) => {
    setActiveProjectId(projId);
    if (projId) {
      router.push(`/price-watch?projectId=${projId}`);
    } else {
      router.push('/price-watch');
    }
  };

  const activeProjectName = allProjects.find(p => p.id === activeProjectId)?.name || 'All Projects';

  return (
    <div className="flex w-screen h-screen overflow-hidden bg-[#FBF9F6] font-dmsans">
      {/* Left Sidebar */}
      <Sidebar
        projects={allProjects}
        activeProjectId={activeProjectId || undefined}
        isCollapsed={isSidebarCollapsed}
        setIsCollapsed={setIsSidebarCollapsed}
        activeNavItem="Price Watch"
        onNavClick={handleNavClick}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full overflow-y-auto bg-[#F5F3EE] p-6 md:p-8">
        {/* Header Title */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="font-lora text-3xl font-normal text-[#191919] tracking-tight">Price Watch Center</h1>
            <p className="text-xs text-slate-500 mt-1.5">
              Track products, configure automated check intervals, and dispatch instant target-price alerts.
            </p>
          </div>

          {/* Project selector dropdown */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Project Filter:</span>
            <select
              value={activeProjectId || ''}
              onChange={(e) => handleProjectSelect(e.target.value || null)}
              className="bg-[#FFFFFF] border border-[#E5E0DA] text-xs font-semibold text-[#191919] rounded-xl px-3 py-2 focus:outline-none focus:border-[#D97757] hover:border-[#D97757]/60 shadow-xs transition-all cursor-pointer"
            >
              <option value="">All Projects (Global)</option>
              {allProjects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Dashboard Component */}
        <PriceWatchDashboard projectId={activeProjectId} />
      </div>
    </div>
  );
}
