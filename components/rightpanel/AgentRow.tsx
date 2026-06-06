'use client';

import { Agent } from '../../types';
import { Bot, CheckCircle2, Circle, AlertCircle, Loader2 } from 'lucide-react';

interface AgentRowProps {
  agent: Agent;
  isActive: boolean;
  onClick: () => void;
}

export default function AgentRow({ agent, isActive, onClick }: AgentRowProps) {
  const getStatusBadge = () => {
    switch (agent.status) {
      case 'running':
        return (
          <span className="flex items-center gap-1 text-[10px] text-[#7C3AED] bg-[#F0EBF8] border border-[#DDD6FE] px-2 py-0.5 rounded-full font-semibold">
            <Loader2 className="w-2.5 h-2.5 animate-spin shrink-0 text-[#7C3AED]" />
            <span>Running</span>
          </span>
        );
      case 'done':
        return (
          <span className="flex items-center gap-1 text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full font-semibold">
            <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600 shrink-0" />
            <span>Done</span>
          </span>
        );
      case 'error':
        return (
          <span className="flex items-center gap-1 text-[10px] text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full font-semibold">
            <AlertCircle className="w-2.5 h-2.5 text-red-600 shrink-0" />
            <span>Error</span>
          </span>
        );
      default:
        return (
          <span className="flex items-center gap-1 text-[10px] text-[#6B6861] bg-[#EFEDE8] border border-[#E5E2DB] px-2 py-0.5 rounded-full font-medium">
            <Circle className="w-2.5 h-2.5 shrink-0 text-[#8A8780]" />
            <span>Pending</span>
          </span>
        );
    }
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center justify-between p-3 rounded-xl border transition-colors text-left cursor-pointer ${
        isActive
          ? 'bg-white border-[#C8C4BC] ring-1 ring-[#C8C4BC]/10 shadow-sm'
          : 'bg-transparent border-[#E5E2DB] hover:bg-white hover:border-[#C8C4BC]/50'
      }`}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <div className={`p-1.5 rounded-lg shrink-0 ${
          isActive ? 'bg-[#EFEDE8] text-[#1A1A18]' : 'bg-[#EFEDE8]/50 text-[#8A8780]'
        }`}>
          <Bot className="w-4 h-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-[#1A1A18] truncate">
            {agent.name}
          </div>
          <div className="text-xs text-[#6B6861] truncate font-medium">
            {agent.role}
          </div>
        </div>
      </div>
      <div className="shrink-0 ml-2">
        {getStatusBadge()}
      </div>
    </button>
  );
}
