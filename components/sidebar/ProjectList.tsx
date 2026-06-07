'use client';

import { Project } from '../../types';
import { useRouter } from 'next/navigation';
import { Folder, Pin, Edit2, Share2, Trash2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';

interface ProjectListProps {
  projects: Project[];
  activeProjectId?: string;
}

export default function ProjectList({ projects, activeProjectId }: ProjectListProps) {
  const router = useRouter();
  const [localProjects, setLocalProjects] = useState<Project[]>(projects);
  const [pinnedIds, setPinnedIds] = useState<string[]>([]);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [copiedProjectId, setCopiedProjectId] = useState<string | null>(null);

  useEffect(() => {
    setLocalProjects(projects);
  }, [projects]);

  useEffect(() => {
    const saved = localStorage.getItem('pinned-projects');
    if (saved) {
      try {
        setPinnedIds(JSON.parse(saved));
      } catch (e) {}
    }
  }, []);

  const togglePin = (projectId: string) => {
    let nextPinned: string[];
    if (pinnedIds.includes(projectId)) {
      nextPinned = pinnedIds.filter(id => id !== projectId);
    } else {
      nextPinned = [...pinnedIds, projectId];
    }
    setPinnedIds(nextPinned);
    localStorage.setItem('pinned-projects', JSON.stringify(nextPinned));
  };

  const handleRenameStart = (projectId: string, currentName: string) => {
    setEditingProjectId(projectId);
    setRenameValue(currentName);
  };

  const handleRenameCancel = () => {
    setEditingProjectId(null);
    setRenameValue('');
  };

  const handleRenameSubmit = async (projectId: string) => {
    if (!renameValue.trim()) return;
    try {
      const response = await fetch(`/api/project/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: renameValue.trim() }),
      });
      if (response.ok) {
        setLocalProjects(prev =>
          prev.map(p => (p.id === projectId ? { ...p, name: renameValue.trim() } : p))
        );
        setEditingProjectId(null);
        router.refresh();
      }
    } catch (e) {
      console.error('Failed to rename project:', e);
    }
  };

  const handleDelete = async (projectId: string) => {
    const confirmed = window.confirm('Are you sure you want to delete this conversation? This will delete all messages and child agents.');
    if (!confirmed) return;

    try {
      const response = await fetch(`/api/project/${projectId}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        setLocalProjects(prev => prev.filter(p => p.id !== projectId));
        if (projectId === activeProjectId) {
          router.push('/workspace');
        }
        router.refresh();
      }
    } catch (e) {
      console.error('Failed to delete project:', e);
    }
  };

  const handleShare = async (projectId: string) => {
    try {
      const shareUrl = `${window.location.origin}/project/${projectId}`;
      await navigator.clipboard.writeText(shareUrl);
      setCopiedProjectId(projectId);
      setTimeout(() => setCopiedProjectId(null), 2000);
    } catch (err) {
      console.error('Failed to copy share link:', err);
    }
  };

  if (localProjects.length === 0) {
    return (
      <div className="px-3 py-2 text-xs text-[#71717A] italic font-dmsans">
        No recent projects
      </div>
    );
  }

  const sortedProjects = [...localProjects].sort((a, b) => {
    const aPinned = pinnedIds.includes(a.id);
    const bPinned = pinnedIds.includes(b.id);
    if (aPinned && !bPinned) return -1;
    if (!aPinned && bPinned) return 1;
    return 0;
  });

  return (
    <div className="space-y-1 mt-1 max-h-[220px] overflow-y-auto pr-1">
      {sortedProjects.map((project) => {
        const isActive = project.id === activeProjectId;
        const isPinned = pinnedIds.includes(project.id);
        return (
          <motion.div
            key={project.id}
            whileHover={{ x: 2 }}
            transition={{ duration: 0.1, ease: 'easeOut' }}
            className={`w-full flex items-center justify-between px-3 py-1.5 text-xs rounded-xl transition-all duration-150 text-left font-dmsans group relative border ${
              isActive
                ? 'bg-[#FFFFFF]/90 text-[#191919] font-bold border-[#E5E0DA] shadow-[0_2px_8px_rgba(25,25,25,0.03)] backdrop-blur-md'
                : 'text-[#5E5B56] hover:bg-[#ECE5DD] hover:text-[#191919] border-transparent hover:border-transparent'
            }`}
          >
            {editingProjectId === project.id ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleRenameSubmit(project.id);
                }}
                className="flex-1 flex items-center min-w-0"
                onClick={(e) => e.stopPropagation()}
              >
                <input
                  type="text"
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onBlur={() => handleRenameCancel()}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') handleRenameCancel();
                  }}
                  className="w-full bg-[#FFFFFF] border border-[#C2BCB2] rounded px-1.5 py-0.5 text-xs text-[#191919] focus:outline-none focus:ring-1 focus:ring-primary font-dmsans"
                  autoFocus
                />
              </form>
            ) : (
              <div
                onClick={() => router.push(`/project/${project.id}`)}
                className="flex-1 min-w-0 flex items-center gap-2 cursor-pointer truncate mr-1.5 py-1"
              >
                <Folder className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-[#D97757]' : 'text-[#85827D]'}`} />
                <span className="truncate flex-1">{project.name}</span>
                {isPinned && <Pin className="w-2.5 h-2.5 text-[#D97757] fill-[#D97757] shrink-0 ml-1 opacity-70" />}
              </div>
            )}

            {/* Hover Actions */}
            {editingProjectId !== project.id && (
              <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 shrink-0 bg-transparent pl-1 z-10 transition-opacity duration-150 select-none">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    togglePin(project.id);
                  }}
                  className="p-1 hover:bg-[#FAF8F5]/80 text-[#85827D] hover:text-[#191919] rounded-md transition-colors cursor-pointer"
                  title={isPinned ? "Unpin project" : "Pin project"}
                >
                  <Pin className={`w-3 h-3 ${isPinned ? 'text-[#D97757] fill-[#D97757]' : ''}`} />
                </button>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRenameStart(project.id, project.name);
                  }}
                  className="p-1 hover:bg-[#FAF8F5]/80 text-[#85827D] hover:text-[#191919] rounded-md transition-colors cursor-pointer"
                  title="Rename"
                >
                  <Edit2 className="w-3 h-3" />
                </button>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleShare(project.id);
                  }}
                  className="p-1 hover:bg-[#FAF8F5]/80 text-[#85827D] hover:text-[#191919] rounded-md transition-colors cursor-pointer relative"
                  title="Share Link"
                >
                  {copiedProjectId === project.id && (
                    <span className="absolute -top-7 right-0 bg-[#191919] text-white text-[9px] font-bold py-0.5 px-1.5 rounded shadow-xs whitespace-nowrap z-20 animate-fadeIn">
                      Copied!
                    </span>
                  )}
                  <Share2 className="w-3 h-3" />
                </button>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(project.id);
                  }}
                  className="p-1 hover:bg-[#FAF8F5]/80 text-[#85827D] hover:text-rose-600 rounded-md transition-colors cursor-pointer"
                  title="Delete"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </motion.div>
        );
      })}
    </div>
  );
}
