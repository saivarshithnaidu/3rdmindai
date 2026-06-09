'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Sidebar from '../../components/sidebar/Sidebar';
import ImageGallery from '../../components/image/ImageGallery';
import { Project } from '../../types';
import { AlertCircle } from 'lucide-react';

interface GalleryPageClientProps {
  initialProjectId: string | null;
  allProjects: Project[];
}

export default function GalleryPageClient({
  initialProjectId,
  allProjects,
}: GalleryPageClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(initialProjectId);

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
    } else if (label === 'Customize') {
      alert("Customization option coming soon!");
    }
  };

  const handleProjectSelect = (projId: string | null) => {
    setActiveProjectId(projId);
    if (projId) {
      router.push(`/gallery?projectId=${projId}`);
    } else {
      router.push('/gallery');
    }
  };

  const userId = '00000000-0000-0000-0000-000000000000';

  return (
    <div className="flex w-screen h-screen overflow-hidden bg-canvas font-dmsans">
      <Sidebar
        projects={allProjects}
        activeProjectId={activeProjectId || undefined}
        isCollapsed={isSidebarCollapsed}
        setIsCollapsed={setIsSidebarCollapsed}
        activeNavItem="Gallery"
        onNavClick={handleNavClick}
      />

      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <div className="p-4 border-b border-hairline bg-canvas flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0 text-left">
          <div>
            <h1 className="font-lora text-2xl font-normal text-ink tracking-tight">Image Gallery</h1>
            <p className="text-xs text-muted mt-1">
              Browse all AI-generated images across agents and tasks. Download, copy, or reuse in your startup assets.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-muted uppercase tracking-wider">Active Workspace:</span>
            <select
              value={activeProjectId || ''}
              onChange={(e) => handleProjectSelect(e.target.value || null)}
              className="bg-[#FFFFFF] border border-[#E5E0DA] text-xs font-semibold text-ink rounded-xl px-3 py-2 focus:outline-none focus:border-[#cc785c] hover:border-[#cc785c]/60 shadow-2xs transition-all cursor-pointer"
            >
              <option value="">Select a Project...</option>
              {allProjects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex-1 overflow-hidden relative">
          {activeProjectId ? (
            <ImageGallery projectId={activeProjectId} userId={userId} />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center max-w-sm mx-auto space-y-4">
              <AlertCircle className="w-10 h-10 text-[#cc785c]" />
              <div className="space-y-2">
                <h3 className="font-serif text-lg font-normal text-ink">Choose a Project Workspace</h3>
                <p className="text-xs text-muted-soft leading-relaxed">
                  Select an active startup project in the dropdown above to browse generated images and visual assets.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
