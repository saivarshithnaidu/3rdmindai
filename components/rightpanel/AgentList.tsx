'use client';

import { Agent } from '../../types';
import AgentRow from './AgentRow';

interface AgentListProps {
  agents: Agent[];
  selectedAgentId?: string | null;
  onSelectAgent: (agentId: string | null) => void;
}

export default function AgentList({ agents, selectedAgentId, onSelectAgent }: AgentListProps) {
  // Filter sub-agents
  const subAgents = agents.filter(a => a.type === 'subagent');

  return (
    <div className="space-y-2 max-h-[300px] overflow-y-auto">
      {/* Orchestrator Navigation Button */}
      <button
        type="button"
        onClick={() => onSelectAgent(null)}
        className={`w-full flex items-center justify-between p-3 rounded-xl border transition-colors text-left cursor-pointer ${
          selectedAgentId === null
            ? 'bg-white border-[#C8C4BC] ring-1 ring-[#C8C4BC]/10 shadow-sm'
            : 'bg-transparent border-[#E5E2DB] hover:bg-white hover:border-[#C8C4BC]/50'
        }`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className={`p-1.5 rounded-lg shrink-0 ${
            selectedAgentId === null ? 'bg-[#EFEDE8] text-[#1A1A18]' : 'bg-[#EFEDE8]/50 text-[#8A8780]'
          }`}>
            <span className="font-lora font-bold text-xs">3M</span>
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-[#1A1A18] truncate">
              3RDMIND Orchestrator
            </div>
            <div className="text-xs text-[#6B6861] truncate font-medium">
              Lead Orchestration Mind
            </div>
          </div>
        </div>
      </button>

      {/* Sub-agents Section Header */}
      {subAgents.length > 0 && (
        <>
          <div className="text-[10px] font-bold uppercase tracking-wider text-[#8A8780] pt-2 px-1">
            Sub-agents ({subAgents.length})
          </div>
          <div className="space-y-2">
            {subAgents.map((agent) => (
              <AgentRow
                key={agent.id}
                agent={agent}
                isActive={selectedAgentId === agent.id}
                onClick={() => onSelectAgent(agent.id)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
