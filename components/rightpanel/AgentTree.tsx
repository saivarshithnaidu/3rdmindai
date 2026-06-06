'use client';

import { Agent, AgentNode } from '../../types';
import { Bot, CheckCircle2, Circle, AlertCircle, Loader2, Coins, Zap } from 'lucide-react';
import React, { useMemo, useState, useEffect } from 'react';

interface AgentTreeProps {
  agents: Agent[];
  selectedAgentId?: string | null;
  onSelectAgent: (agentId: string | null) => void;
}

export default function AgentTree({ agents, selectedAgentId, onSelectAgent }: AgentTreeProps) {
  const [toolCounts, setToolCounts] = useState<Record<string, number>>({});

  // Fetch tool calls count for each agent
  useEffect(() => {
    if (agents.length === 0) return;
    const projectId = agents[0].project_id;

    const fetchToolCalls = async () => {
      try {
        const response = await fetch(`/api/tool-calls?projectId=${projectId}`);
        if (response.ok) {
          const data = await response.json();
          const counts: Record<string, number> = {};
          data.forEach((call: any) => {
            counts[call.agent_id] = (counts[call.agent_id] || 0) + 1;
          });
          setToolCounts(counts);
        }
      } catch (err) {
        console.warn('Failed to load tool call stats for agent tree:', err);
      }
    };

    fetchToolCalls();
    const interval = setInterval(fetchToolCalls, 5000);
    return () => clearInterval(interval);
  }, [agents]);

  // 1. Build client-side tree structure
  const treeNodes = useMemo(() => {
    const nodes: AgentNode[] = agents.map((a) => ({ ...a, children: [] }));
    const tree: AgentNode[] = [];
    const nodeMap: Record<string, AgentNode> = {};

    for (const node of nodes) {
      nodeMap[node.id] = node;
    }

    for (const node of nodes) {
      if (node.parent_agent_id) {
        const parent = nodeMap[node.parent_agent_id];
        if (parent) {
          parent.children.push(node);
        } else {
          tree.push(node);
        }
      } else {
        tree.push(node);
      }
    }
    return tree;
  }, [agents]);

  // 2. Flatten tree using depth-first search for proper ordering
  const flattenedNodes = useMemo(() => {
    const list: AgentNode[] = [];
    function traverse(node: AgentNode) {
      list.push(node);
      // Sort children by creation date to keep consistent UI order
      const sortedChildren = [...node.children].sort(
        (a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime()
      );
      sortedChildren.forEach(traverse);
    }
    treeNodes.forEach(traverse);
    return list;
  }, [treeNodes]);

  const getStatusBadge = (agent: Agent) => {
    switch (agent.status) {
      case 'running':
        return (
          <span className="flex items-center gap-1.5 text-[9px] text-blue-700 bg-blue-50/50 border border-blue-200 px-2 py-0.5 rounded-full font-bold select-none">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 pulse-glow-running" />
            <span>Running</span>
          </span>
        );
      case 'done':
        return (
          <span className="flex items-center gap-1.5 text-[9px] text-emerald-700 bg-emerald-50/50 border border-emerald-200 px-2 py-0.5 rounded-full font-bold select-none">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 pulse-glow-done" />
            <span>Done</span>
          </span>
        );
      case 'error':
        return (
          <span className="flex items-center gap-1.5 text-[9px] text-rose-700 bg-rose-50/50 border border-rose-200 px-2 py-0.5 rounded-full font-bold select-none">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 pulse-glow-error" />
            <span>Error</span>
          </span>
        );
      default:
        return (
          <span className="flex items-center gap-1.5 text-[9px] text-[#5E5B56] bg-white border border-[#E5E0DA] px-2 py-0.5 rounded-full font-semibold select-none">
            <span className="w-1.5 h-1.5 rounded-full bg-[#A5A19C]" />
            <span>Pending</span>
          </span>
        );
    }
  };
  
  const getModelBadge = (modelId?: string | null) => {
    if (!modelId) return null;
    const id = modelId.toLowerCase();
    
    let label = '';
    let bgColor = '';
    let textColor = '';
    let borderColor = '';

    if (id.includes('gemini')) {
      label = 'Gemini';
      bgColor = 'bg-[#EBF5FF]';
      textColor = 'text-[#1D4ED8]';
      borderColor = 'border-[#BFDBFE]';
    } else if (id.includes('gpt-4o')) {
      label = 'GPT-4o';
      bgColor = 'bg-[#ECFDF5]';
      textColor = 'text-[#047857]';
      borderColor = 'border-[#A7F3D0]';
    } else if (id.includes('deepseek')) {
      label = 'DeepSeek';
      bgColor = 'bg-[#F4F4F5]';
      textColor = 'text-[#27272A]';
      borderColor = 'border-[#E4E4E7]';
    } else if (id.includes('llama')) {
      label = 'Llama 3';
      bgColor = 'bg-[#FAF5FF]';
      textColor = 'text-[#6B21A8]';
      borderColor = 'border-[#E9D5FF]';
    } else if (id.includes('mistral')) {
      label = 'Mistral';
      bgColor = 'bg-[#FFF7ED]';
      textColor = 'text-[#C2410C]';
      borderColor = 'border-[#FED7AA]';
    } else {
      label = modelId.split('/').pop() || modelId;
      bgColor = 'bg-[#F9F8F6]';
      textColor = 'text-[#5E5B56]';
      borderColor = 'border-[#E5E0DA]';
    }

    return (
      <span className={`text-[8px] px-1.5 py-0.5 rounded font-mono font-bold border ${bgColor} ${textColor} ${borderColor} uppercase select-none tracking-tight shrink-0`}>
        {label}
      </span>
    );
  };

  const formatTokens = (tokens: number) => {
    if (tokens >= 1000) {
      return `${(tokens / 1000).toFixed(1)}k`;
    }
    return tokens.toString();
  };

  return (
    <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1 font-dmsans">
      {flattenedNodes.length === 0 ? (
        <div className="text-center text-xs text-[#85827D] py-4 bg-[#FFFFFF]/50 rounded-xl border border-[#E5E0DA] border-dashed">
          No active agents.
        </div>
      ) : (
        flattenedNodes.map((node) => {
          const isSelected = selectedAgentId === node.id;
          const isOrchestrator = node.type === 'orchestrator';
          const indentation = (node.depth - 1) * 16;

          return (
            <div key={node.id} style={{ paddingLeft: `${indentation}px` }} className="transition-all duration-200">
              <button
                type="button"
                onClick={() => onSelectAgent(node.id)}
                className={`w-full flex items-start justify-between p-2.5 rounded-xl border transition-all text-left cursor-pointer ${
                  isSelected
                    ? 'bg-[#FFFFFF] border-[#E5E0DA] shadow-xs'
                    : 'bg-transparent border-transparent hover:bg-[#ECE5DD]'
                }`}
              >
                <div className="flex items-start gap-2 min-w-0 flex-1">
                  <div className={`p-1.5 rounded-lg shrink-0 mt-0.5 ${
                    isSelected ? 'bg-[#ECE9FC] text-[#5B39E0]' : 'bg-[#FFFFFF] border border-[#E5E0DA] text-[#85827D]'
                  }`}>
                    {isOrchestrator ? (
                      <span className="font-lora font-bold text-xs leading-none select-none block w-4 h-4 text-center mt-0.5">3M</span>
                    ) : (
                      <Bot className="w-4 h-4" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-[#191919] truncate leading-tight font-lora">
                      {node.name}
                    </div>
                    <div className="text-xs text-[#5E5B56] truncate font-medium mt-0.5 flex items-center gap-1.5">
                      <span className="truncate">{node.role}</span>
                      {!isOrchestrator && node.model && (
                        <>
                          <span className="text-neutral-400 select-none text-[8px]">•</span>
                          {getModelBadge(node.model)}
                        </>
                      )}
                    </div>

                    {/* Progress tracking details for Managers */}
                    {node.agent_mode === 'manager' && node.children_count > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                        <div className="text-[10px] text-[#5B39E0] font-semibold bg-[#ECE9FC] border border-[#D5CFF8] px-1.5 py-0.5 rounded-md inline-block">
                          Sub-agents: {node.children_done} / {node.children_count} done
                        </div>
                        {node.name.toLowerCase().includes('council') && node.status === 'done' && node.children_done >= node.children_count && (
                          <button
                            type="button"
                            onClick={async (e) => {
                              e.stopPropagation();
                              try {
                                const res = await fetch(`/api/council/transcript?managerId=${node.id}&projectId=${node.project_id}`);
                                if (!res.ok) throw new Error('Transcript export failed');
                                const blob = await res.blob();
                                const url = window.URL.createObjectURL(blob);
                                const a = document.createElement('a');
                                a.href = url;
                                a.download = `council-transcript-${node.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.md`;
                                document.body.appendChild(a);
                                a.click();
                                a.remove();
                                window.URL.revokeObjectURL(url);
                              } catch (err) {
                                console.error(err);
                                alert('Failed to export transcript');
                              }
                            }}
                            className="text-[9px] text-white bg-purple-600 hover:bg-purple-750 font-bold px-2 py-0.5 rounded-md inline-block transition-colors cursor-pointer border border-transparent shadow-3xs"
                          >
                            Export Transcript
                          </button>
                        )}
                      </div>
                    )}

                    {/* Stats horizontal line container (tokens + tools executed) */}
                    <div className="flex flex-wrap items-center gap-3 mt-1.5 select-none">
                      {node.token_budget > 0 && (
                        <div className="flex items-center gap-1 text-[10px] text-[#85827D] font-medium">
                          <Coins className="w-3.5 h-3.5 text-[#85827D]" />
                          <span>
                            {formatTokens(node.tokens_used)} / {formatTokens(node.token_budget)}
                          </span>
                        </div>
                      )}

                      {toolCounts[node.id] > 0 && (
                        <div className="flex items-center gap-1 text-[10px] text-[#9A6B24] font-medium">
                          <Zap className="w-3 h-3 text-[#D97757]" />
                          <span>
                            {toolCounts[node.id]} tool{toolCounts[node.id] > 1 ? 's' : ''} run
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="shrink-0 ml-2 mt-0.5">
                  {getStatusBadge(node)}
                </div>
              </button>
            </div>
          );
        })
      )}
    </div>
  );
}
