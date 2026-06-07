'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { StartupAgent, AgentRole } from '../../types';
import { Play, Eye, FileText, Brain, Clock } from 'lucide-react';

interface AgentCardProps {
  agent: StartupAgent & {
    memory_count?: number;
    latest_task?: {
      title: string;
      status: string;
      created_at: string;
    } | null;
  };
  projectId: string;
  onGiveTask: (agent: StartupAgent) => void;
}

const roleMeta: Record<AgentRole, {
  initial: string;
  title: string;
  bgClass: string;
  textClass: string;
  borderClass: string;
}> = {
  ceo: { initial: 'C', title: 'Chief Executive Officer', bgClass: 'bg-blue-50', textClass: 'text-blue-600', borderClass: 'border-blue-200/50' },
  cmo: { initial: 'M', title: 'Chief Marketing Officer', bgClass: 'bg-purple-50', textClass: 'text-purple-600', borderClass: 'border-purple-200/50' },
  cto: { initial: 'T', title: 'Chief Technology Officer', bgClass: 'bg-teal-50', textClass: 'text-teal-600', borderClass: 'border-teal-200/50' },
  cfo: { initial: 'F', title: 'Chief Financial Officer', bgClass: 'bg-amber-50', textClass: 'text-amber-600', borderClass: 'border-amber-200/50' },
  cso: { initial: 'S', title: 'Chief Sales Officer', bgClass: 'bg-rose-50', textClass: 'text-rose-600', borderClass: 'border-rose-200/50' },
  cro: { initial: 'R', title: 'Chief Research Officer', bgClass: 'bg-green-50', textClass: 'text-green-600', borderClass: 'border-green-200/50' },
};

function formatRelativeTime(dateStr?: string | null): string {
  if (!dateStr) return 'Never';
  const time = new Date(dateStr).getTime();
  const diff = Date.now() - time;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function AgentCard({ agent, projectId, onGiveTask }: AgentCardProps) {
  const router = useRouter();
  const meta = roleMeta[agent.role] || {
    initial: agent.role.slice(0, 1).toUpperCase(),
    title: agent.role.toUpperCase(),
    bgClass: 'bg-gray-100',
    textClass: 'text-gray-600',
    borderClass: 'border-gray-200',
  };

  const modelBadge = agent.model.split('/').pop() || agent.model;

  return (
    <motion.div
      whileHover={{ y: -4 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className={`bg-white border border-[#E5E0DA] rounded-3xl p-5 flex flex-col justify-between hover:shadow-[0_8px_24px_rgba(25,25,25,0.02)] transition-all relative overflow-hidden ${
        !agent.is_active ? 'opacity-60' : ''
      }`}
    >
      {/* Top section */}
      <div>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            {/* Avatar Circle */}
            <div className={`w-11 h-11 rounded-2xl ${meta.bgClass} ${meta.textClass} border ${meta.borderClass} flex items-center justify-center font-extrabold text-base shadow-xs`}>
              {meta.initial}
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-[#191919]">{agent.name}</h3>
              <p className="text-[10px] text-[#5E5B56] font-medium">{meta.title}</p>
            </div>
          </div>

          {/* Model Badge */}
          <span className="text-[9px] bg-[#F4F0EB] text-[#5E5B56] border border-[#E5E0DA] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider scale-95">
            {modelBadge}
          </span>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-2 py-4 border-b border-[#E5E0DA] mt-4 text-center">
          <div className="flex flex-col items-center">
            <span className="text-xs font-extrabold text-[#191919] flex items-center gap-1">
              <FileText className="w-3.5 h-3.5 text-[#85827D]" />
              {agent.tasks_completed}
            </span>
            <span className="text-[9px] text-[#85827D] font-bold uppercase tracking-wider mt-0.5">Tasks</span>
          </div>

          <div className="flex flex-col items-center border-x border-[#E5E0DA]">
            <span className="text-xs font-extrabold text-[#191919] flex items-center gap-1">
              <Brain className="w-3.5 h-3.5 text-[#85827D]" />
              {agent.memory_count || 0}
            </span>
            <span className="text-[9px] text-[#85827D] font-bold uppercase tracking-wider mt-0.5">Memories</span>
          </div>

          <div className="flex flex-col items-center">
            <span className="text-xs font-extrabold text-[#191919] flex items-center gap-1 truncate max-w-full">
              <Clock className="w-3.5 h-3.5 text-[#85827D]" />
              <span className="truncate">{formatRelativeTime(agent.last_run_at)}</span>
            </span>
            <span className="text-[9px] text-[#85827D] font-bold uppercase tracking-wider mt-0.5">Last Run</span>
          </div>
        </div>

        {/* Latest task preview */}
        <div className="mt-4 space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#85827D]">Latest Action</span>
          {agent.latest_task ? (
            <div className="bg-[#FBF9F6] border border-[#E5E0DA] rounded-2xl p-3 flex flex-col gap-1.5">
              <p className="text-xs text-[#191919] font-semibold truncate leading-normal">
                {agent.latest_task.title}
              </p>
              <div className="flex items-center justify-between">
                <span className="text-[9px] text-[#85827D] font-bold uppercase tracking-wider">Status</span>
                {/* No status indicators/dots - show text only as requested */}
                <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                  agent.latest_task.status === 'running' 
                    ? 'text-blue-600 bg-blue-50 border border-blue-100'
                    : agent.latest_task.status === 'done'
                    ? 'text-green-600 bg-green-50 border border-green-100'
                    : agent.latest_task.status === 'queued'
                    ? 'text-amber-600 bg-amber-50 border border-amber-100'
                    : 'text-red-600 bg-red-50 border border-red-100' // failed
                }`}>
                  {agent.latest_task.status}
                </span>
              </div>
            </div>
          ) : (
            <p className="text-xs text-[#85827D] italic py-1">No tasks executed yet.</p>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-2 mt-5">
        <button
          type="button"
          disabled={!agent.is_active}
          onClick={() => onGiveTask(agent)}
          className="flex-1 flex items-center justify-center gap-1.5 bg-[#D97757] hover:bg-[#c66545] disabled:bg-[#ECE5DD] disabled:text-[#85827D] disabled:cursor-not-allowed text-white rounded-xl py-2 text-xs font-bold transition-colors cursor-pointer"
        >
          <Play className="w-3.5 h-3.5" />
          <span>Give task</span>
        </button>

        <button
          type="button"
          onClick={() => router.push(`/startup/${projectId}/agent/${agent.id}`)}
          className="flex-1 flex items-center justify-center gap-1.5 bg-white hover:bg-[#FBF9F6] border border-[#E5E0DA] text-[#191919] rounded-xl py-2 text-xs font-bold transition-colors cursor-pointer"
        >
          <Eye className="w-3.5 h-3.5" />
          <span>View workspace</span>
        </button>
      </div>
    </motion.div>
  );
}
