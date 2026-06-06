'use client';

import { Project } from '../../types';
import { useRouter } from 'next/navigation';
import { Folder } from 'lucide-react';
import { motion } from 'framer-motion';

interface ProjectListProps {
  projects: Project[];
  activeProjectId?: string;
}

export default function ProjectList({ projects, activeProjectId }: ProjectListProps) {
  const router = useRouter();

  if (projects.length === 0) {
    return (
      <div className="px-3 py-2 text-xs text-[#71717A] italic font-dmsans">
        No recent projects
      </div>
    );
  }

  return (
    <div className="space-y-1 mt-1 max-h-[220px] overflow-y-auto pr-1">
      {projects.map((project) => {
        const isActive = project.id === activeProjectId;
        return (
          <motion.button
            key={project.id}
            type="button"
            onClick={() => router.push(`/project/${project.id}`)}
            whileHover={{ x: 4 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className={`w-full flex items-center gap-2 px-3 py-2.5 text-xs rounded-xl transition-all duration-150 text-left truncate cursor-pointer font-dmsans ${
              isActive
                ? 'bg-[#FFFFFF]/90 text-[#191919] font-bold border border-[#E5E0DA] shadow-[0_2px_8px_rgba(25,25,25,0.03)] backdrop-blur-md'
                : 'text-[#5E5B56] hover:bg-[#ECE5DD] hover:text-[#191919] border border-transparent'
            }`}
          >
            <Folder className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-[#D97757]' : 'text-[#85827D]'}`} />
            <span className="truncate">{project.name}</span>
          </motion.button>
        );
      })}
    </div>
  );
}
