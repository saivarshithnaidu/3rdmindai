'use client';

import React, { useMemo } from 'react';
import { Agent } from '../../types';
import { ChevronRight, ArrowLeft, FolderOpen } from 'lucide-react';

interface AgentBreadcrumbProps {
  agents: Agent[];
  selectedAgentId: string | null;
  onSelectAgent: (agentId: string | null) => void;
  isHeaderMode?: boolean;
}

export default function AgentBreadcrumb({
  agents,
  selectedAgentId,
  onSelectAgent,
  isHeaderMode = false,
}: AgentBreadcrumbProps) {
  // Compute breadcrumb path from the selected agent to the root orchestrator
  const path = useMemo(() => {
    if (!selectedAgentId) {
      const orchestrator = agents.find((a) => a.type === 'orchestrator');
      return orchestrator ? [orchestrator] : [];
    }

    const currentAgent = agents.find((a) => a.id === selectedAgentId);
    if (!currentAgent) return [];

    const chain: Agent[] = [];
    let temp: Agent | undefined = currentAgent;
    while (temp) {
      chain.unshift(temp);
      if (temp.parent_agent_id) {
        temp = agents.find((a) => a.id === temp!.parent_agent_id);
      } else {
        temp = undefined;
      }
    }

    // Ensure the Root Orchestrator is at the head of the breadcrumb chain
    const orchestrator = agents.find((a) => a.type === 'orchestrator');
    if (orchestrator && !chain.some((a) => a.id === orchestrator.id)) {
      chain.unshift(orchestrator);
    }

    return chain;
  }, [agents, selectedAgentId]);

  const parentAgent = path.length > 1 ? path[path.length - 2] : null;

  const handleBack = () => {
    if (!parentAgent) return;
    onSelectAgent(parentAgent.type === 'orchestrator' ? null : parentAgent.id);
  };

  if (path.length === 0) return null;

  return (
    <div className={isHeaderMode
      ? "flex items-center gap-2 select-none font-dmsans z-10 min-w-0"
      : "flex items-center gap-4 py-2.5 px-4 border-b border-[#E5E0DA] bg-[#FBF9F6] shrink-0 select-none font-dmsans z-10 shadow-[0_1px_2px_rgba(0,0,0,0.01)]"
    }>
      {/* Back Button */}
      {parentAgent && (
        <button
          type="button"
          onClick={handleBack}
          className={`flex items-center gap-1 text-xs text-[#5E5B56] hover:text-[#191919] bg-[#FFFFFF] hover:bg-[#F9F8F6] border border-[#E5E0DA] rounded-lg transition-colors cursor-pointer font-semibold shadow-xs shrink-0 ${
            isHeaderMode ? 'px-2 py-0.75' : 'px-2.5 py-1.5'
          }`}
        >
          <ArrowLeft className="w-3 h-3" />
          <span>Back</span>
        </button>
      )}

      {/* Path Display */}
      <div className="flex items-center gap-1.5 text-xs text-[#5E5B56] font-medium overflow-x-auto whitespace-nowrap scrollbar-none min-w-0">
        {!isHeaderMode && <FolderOpen className="w-3.5 h-3.5 text-[#85827D] shrink-0" />}
        {path.map((node, index) => {
          const isLast = index === path.length - 1;
          const label = node.type === 'orchestrator' ? 'Root Orchestrator' : node.name;

          return (
            <React.Fragment key={node.id}>
              {index > 0 && <ChevronRight className="w-3 h-3 text-[#85827D] shrink-0" />}
              {isLast ? (
                <span className="font-semibold text-[#191919] px-1.5 py-0.5 rounded bg-[#FFFFFF] border border-[#E5E0DA] shadow-2xs shrink-0">
                  {label}
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => onSelectAgent(node.type === 'orchestrator' ? null : node.id)}
                  className="hover:text-[#191919] transition-colors font-semibold cursor-pointer shrink-0"
                >
                  {label}
                </button>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
