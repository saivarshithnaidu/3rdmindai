'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Sidebar from '../../components/sidebar/Sidebar';
import AdIntelDashboard from '../../components/ad-intel/AdIntelDashboard';
import { Project } from '../../types';
import { AlertCircle } from 'lucide-react';

interface AdIntelPageClientProps {
  initialProjectId: string | null;
  allProjects: Project[];
}

export default function AdIntelPageClient({
  initialProjectId,
  allProjects,
}: AdIntelPageClientProps) {
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
      router.push(`/ad-intel?projectId=${projId}`);
    } else {
      router.push('/ad-intel');
    }
  };

  const activeProjectName = allProjects.find(p => p.id === activeProjectId)?.name || 'All Projects';
  const userId = '00000000-0000-0000-0000-000000000000'; // Default guest/demo user

  return (
    <div className="flex w-screen h-screen overflow-hidden bg-canvas font-dmsans">
      {/* Left Sidebar */}
      <Sidebar
        projects={allProjects}
        activeProjectId={activeProjectId || undefined}
        isCollapsed={isSidebarCollapsed}
        setIsCollapsed={setIsSidebarCollapsed}
        activeNavItem="Ad Intel"
        onNavClick={handleNavClick}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Top Header bar with selector */}
        <div className="p-4 border-b border-hairline bg-canvas flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0 text-left">
          <div>
            <h1 className="font-lora text-2xl font-normal text-ink tracking-tight">Competitive Ad Intelligence</h1>
            <p className="text-xs text-muted mt-1">
              Scrape competitors' active campaigns, identify emotional marketing hooks, and formulate variations.
            </p>
          </div>

          {/* Project selector dropdown */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-muted uppercase tracking-wider">Active Workspace:</span>
            <select
              value={activeProjectId || ''}
              onChange={(e) => handleProjectSelect(e.target.value || null)}
              className="bg-[#FFFFFF] border border-[#E5E0DA] text-xs font-semibold text-ink rounded-xl px-3 py-2 focus:outline-none focus:border-[#cc785c] hover:border-[#cc785c]/60 shadow-2xs transition-all cursor-pointer"
            >
              <option value="">Select a Project...</option>
              {allProjects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Dashboard Workspace */}
        <div className="flex-1 overflow-hidden relative">
          {activeProjectId ? (
            <AdIntelDashboard projectId={activeProjectId} userId={userId} />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center max-w-sm mx-auto space-y-4">
              <AlertCircle className="w-10 h-10 text-[#cc785c]" />
              <div className="space-y-2">
                <h3 className="font-serif text-lg font-normal text-ink">Choose a Project Workspace</h3>
                <p className="text-xs text-muted-soft leading-relaxed">
                  Select an active startup project in the dropdown above to manage, crawl, and benchmark competitive marketing intelligence.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
