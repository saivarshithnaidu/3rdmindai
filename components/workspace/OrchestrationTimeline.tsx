'use client';

import React, { useState, useEffect, useMemo } from 'react';
import NeuralSymbol from './NeuralSymbol';
import { 
  Network, 
  MessageSquare, 
  Award, 
  Check, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Activity, 
  TrendingUp, 
  ThumbsUp 
} from 'lucide-react';

interface OrchestrationTimelineProps {
  agents?: any[];
  isFinished?: boolean;
  goal?: string;
}

export default function OrchestrationTimeline({ 
  agents = [], 
  isFinished = false,
  goal = ''
}: OrchestrationTimelineProps) {
  const [activeView, setActiveView] = useState<'network' | 'debate' | 'consensus'>('network');

  // Resolve agent statuses and lists dynamically
  const subagents = useMemo(() => agents.filter(a => a.type === 'subagent'), [agents]);
  const isOrchestratorActive = useMemo(() => agents.some(a => a.type === 'orchestrator' && a.status === 'running'), [agents]);

  // Derived state values
  let researchStatus: 'completed' | 'running' | 'waiting' | 'failed' = 'completed';
  let validationStatus: 'completed' | 'running' | 'waiting' | 'failed' = 'waiting';
  let verdictStatus: 'completed' | 'running' | 'waiting' | 'failed' = 'waiting';

  if (isFinished) {
    researchStatus = 'completed';
    validationStatus = 'completed';
    verdictStatus = 'completed';
  } else {
    if (subagents.length === 0) {
      researchStatus = 'running';
    } else {
      const anyRunning = subagents.some(a => a.status === 'running');
      const anyFailed = subagents.some(a => a.status === 'error');
      
      const researchAgents = subagents.filter(a => a.name.toLowerCase().includes('research') || a.role.toLowerCase().includes('research'));
      const validationAgents = subagents.filter(a => a.name.toLowerCase().includes('validat') || a.role.toLowerCase().includes('validat') || a.name.toLowerCase().includes('council') || a.role.toLowerCase().includes('council'));
      const verdictAgents = subagents.filter(a => a.name.toLowerCase().includes('verdict') || a.role.toLowerCase().includes('verdict'));

      if (anyFailed) {
        researchStatus = 'failed';
        validationStatus = 'failed';
        verdictStatus = 'failed';
      } else {
        const runningResearch = researchAgents.some(a => a.status === 'running');
        const allResearchDone = researchAgents.length > 0 && researchAgents.every(a => a.status === 'done');
        
        if (runningResearch) {
          researchStatus = 'running';
        } else if (allResearchDone || validationAgents.some(a => a.status === 'running' || a.status === 'done')) {
          researchStatus = 'completed';
        } else {
          researchStatus = 'running';
        }

        const runningValidation = validationAgents.some(a => a.status === 'running');
        const allValidationDone = validationAgents.length > 0 && validationAgents.every(a => a.status === 'done');
        
        if (runningValidation) {
          validationStatus = 'running';
        } else if (allValidationDone || verdictAgents.some(a => a.status === 'running' || a.status === 'done')) {
          validationStatus = 'completed';
        } else if (researchStatus === 'completed') {
          validationStatus = 'running';
        } else {
          validationStatus = 'waiting';
        }

        const runningVerdict = verdictAgents.some(a => a.status === 'running') || agents.some(a => a.type === 'orchestrator' && a.status === 'running' && allValidationDone);
        const allVerdictDone = verdictAgents.length > 0 && verdictAgents.every(a => a.status === 'done');
        
        if (runningVerdict) {
          verdictStatus = 'running';
        } else if (allVerdictDone) {
          verdictStatus = 'completed';
        } else if (validationStatus === 'completed') {
          verdictStatus = 'running';
        } else {
          verdictStatus = 'waiting';
        }
      }
    }
  }

  // Active view auto-transition as steps progress
  useEffect(() => {
    if (verdictStatus === 'running' || verdictStatus === 'completed') {
      setActiveView('consensus');
    } else if (validationStatus === 'running') {
      setActiveView('debate');
    } else {
      setActiveView('network');
    }
  }, [researchStatus, validationStatus, verdictStatus]);

  // Determine state mapping for nodes
  const getNodeState = (status: 'completed' | 'running' | 'waiting' | 'failed') => {
    if (status === 'completed') return 'completed';
    if (status === 'failed') return 'failed';
    if (status === 'running') return 'execution';
    return 'idle';
  };

  // Generic dynamic debate points derived from agents and goal
  const debatePoints = useMemo(() => {
    const defaultPoints = [
      {
        mind: 'Research Mind',
        role: 'Market Intelligence',
        model: 'deepseek/deepseek-chat',
        opinion: 'Competitor analysis shows 73% of market leaders prioritize speed-to-market. Crawled 12 core websites to extract layout strategies.',
        action: 'contributing',
        time: '2.5s'
      },
      {
        mind: 'Strategy Mind',
        role: 'Strategic Planner',
        model: 'openai/gpt-4o',
        opinion: 'Speed must be paired with bar-level billing integration. High pricing tier is required to support premium lawyer acquisition strategies.',
        action: 'challenging',
        time: '3.4s'
      },
      {
        mind: 'Finance Mind',
        role: 'Resource Auditor',
        model: 'google/gemini-pro-1.5',
        opinion: 'Increased pricing offset covers integration overhead. Recommended LTV:CAC threshold is 4.1x, which is economically viable.',
        action: 'validating',
        time: '1.8s'
      },
      {
        mind: 'Verdict Arbiter',
        role: 'Council Chairs Consensus',
        model: 'meta-llama/llama-3-70b-instruct',
        opinion: 'Synthesizing lawyer billing integration priority inside final positioning GTM document. Alignment achieved across Strategy and Finance.',
        action: 'synthesizing',
        time: 'Active'
      }
    ];

    // Customize based on current subagents if available
    if (subagents.length > 0) {
      return subagents.map((agent, i) => {
        const statuses = ['contributing', 'challenging', 'validating', 'synthesizing'];
        const statusAction = statuses[i % statuses.length];
        
        let opinionText = '';
        if (agent.status === 'done') {
          opinionText = agent.summary || `Synthesized analysis complete. Provided structured data recommendations matching the ${agent.role} objective.`;
        } else if (agent.status === 'running') {
          opinionText = agent.task ? `Processing: "${agent.task}"` : `Actively compiling specialist directives...`;
        } else {
          opinionText = 'Standing by for consensus deliberation...';
        }

        return {
          mind: agent.name,
          role: agent.role,
          model: agent.model || 'openai/gpt-4o',
          opinion: opinionText,
          action: agent.status === 'running' ? statusAction : agent.status === 'done' ? 'validated' : 'queued',
          time: agent.status === 'done' ? 'Complete' : agent.status === 'running' ? 'Active' : 'Waiting'
        };
      });
    }

    return defaultPoints;
  }, [subagents]);

  // Consensus Score calculation
  const consensusScore = useMemo(() => {
    if (isFinished) return 100;
    if (verdictStatus === 'running') return 88;
    if (validationStatus === 'running') return 65;
    if (researchStatus === 'running') return 35;
    return 10;
  }, [isFinished, researchStatus, validationStatus, verdictStatus]);

  return (
    <div className="w-full border border-[#E9E2D9] bg-[#FBF9F6] rounded-xl p-4 mb-4 select-none shadow-sm animate-fadeIn">
      {/* 1. Header and View Mode Switcher Toggles */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#E9E2D9] mb-4">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-[#cc785c]" />
          <div>
            <h4 className="text-xs font-bold text-[#141413] tracking-wide uppercase font-lora">
              COUNCIL DELIBERATION CHAMBER
            </h4>
            <p className="text-[9px] text-[#5E5B56] font-mono leading-none">
              Goal: {goal || 'Create Go-To-Market & Pricing Strategy'}
            </p>
          </div>
        </div>

        <div className="flex bg-[#F4F0EB] p-0.5 rounded-lg border border-[#E5E0DA] shrink-0 self-start sm:self-center">
          {[
            { key: 'network' as const, label: 'Network View', icon: Network },
            { key: 'debate' as const, label: 'Debate View', icon: MessageSquare },
            { key: 'consensus' as const, label: 'Consensus', icon: Award }
          ].map((mode) => {
            const Icon = mode.icon;
            const isActive = activeView === mode.key;
            return (
              <button
                key={mode.key}
                type="button"
                onClick={() => setActiveView(mode.key)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold transition-all duration-150 cursor-pointer ${
                  isActive 
                    ? 'bg-white text-[#191919] shadow-2xs border border-[#E5E0DA]' 
                    : 'text-[#85827D] hover:text-[#5E5B56]'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{mode.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Mode Content Renderer */}
      <div className="relative min-h-[160px] flex flex-col justify-center">
        
        {/* NETWORK VIEW */}
        {activeView === 'network' && (
          <div className="relative w-full py-2 flex flex-col items-center justify-center animate-fadeIn">
            {/* SVG Connector Lines behind the nodes */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none z-0" style={{ minHeight: '160px' }}>
              <style>{`
                @keyframes dash-rail {
                  to { stroke-dashoffset: -20; }
                }
                .flow-rail {
                  stroke-dasharray: 4 4;
                  animation: dash-rail 2s linear infinite;
                }
              `}</style>
              
              {/* Objective to Research */}
              <path d="M 60 80 Q 150 40 240 40" fill="none" stroke={(researchStatus as string) !== 'waiting' ? '#cc785c' : '#E9E2D9'} strokeWidth="1.5" className={researchStatus === 'running' ? 'flow-rail' : ''} />
              
              {/* Objective to Strategy */}
              <path d="M 60 80 L 240 80" fill="none" stroke={(validationStatus as string) !== 'waiting' ? '#cc785c' : '#E9E2D9'} strokeWidth="1.5" className={validationStatus === 'running' ? 'flow-rail' : ''} />
              
              {/* Objective to Finance */}
              <path d="M 60 80 Q 150 120 240 120" fill="none" stroke={(verdictStatus as string) !== 'waiting' ? '#cc785c' : '#E9E2D9'} strokeWidth="1.5" className={verdictStatus === 'running' ? 'flow-rail' : ''} />

              {/* Research to Verdict Engine */}
              <path d="M 360 40 Q 430 40 500 80" fill="none" stroke={researchStatus === 'completed' ? '#7B61FF' : '#E9E2D9'} strokeWidth="1.5" className={researchStatus === 'completed' && verdictStatus === 'running' ? 'flow-rail' : ''} />
              
              {/* Strategy to Verdict Engine */}
              <path d="M 360 80 L 500 80" fill="none" stroke={validationStatus === 'completed' ? '#7B61FF' : '#E9E2D9'} strokeWidth="1.5" className={validationStatus === 'completed' && verdictStatus === 'running' ? 'flow-rail' : ''} />
              
              {/* Finance to Verdict Engine */}
              <path d="M 360 120 Q 430 120 500 80" fill="none" stroke={verdictStatus === 'completed' ? '#7B61FF' : '#E9E2D9'} strokeWidth="1.5" className={verdictStatus === 'running' ? 'flow-rail' : ''} />

              {/* Verdict Engine to Verdict */}
              <path d="M 600 80 L 680 80" fill="none" stroke={isFinished ? '#5db872' : '#E9E2D9'} strokeWidth="1.5" />
            </svg>

            {/* Nodes Layout */}
            <div className="w-full flex items-center justify-between px-2 sm:px-6 z-10 relative" style={{ minHeight: '130px' }}>
              
              {/* Left Column: Objective */}
              <div className="flex flex-col items-center gap-1.5 w-16 text-center">
                <div className="w-8 h-8 rounded-full bg-white border border-[#cc785c] flex items-center justify-center shadow-2xs">
                  <span className="text-[10px] font-bold text-[#cc785c]">OBJ</span>
                </div>
                <span className="text-[9px] font-bold text-[#141413] tracking-wide uppercase font-mono truncate max-w-full">
                  Objective
                </span>
              </div>

              {/* Middle Column: Specialist Minds */}
              <div className="flex flex-col gap-3.5 my-auto">
                {/* Research Mind Node */}
                <div className="flex items-center gap-2 px-3 py-1 bg-white/95 border border-[#E9E2D9] rounded-lg shadow-3xs w-36">
                  <NeuralSymbol state={getNodeState(researchStatus)} size={14} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[9px] font-bold text-[#141413] truncate">Research Mind</p>
                    <span className="text-[8px] font-mono text-[#8e8b82] uppercase tracking-wider block leading-none">
                      {researchStatus === 'completed' ? '✓ Complete' : researchStatus === 'running' ? '● Active' : 'Waiting'}
                    </span>
                  </div>
                </div>

                {/* Strategy Mind Node */}
                <div className="flex items-center gap-2 px-3 py-1 bg-white/95 border border-[#E9E2D9] rounded-lg shadow-3xs w-36">
                  <NeuralSymbol state={getNodeState(validationStatus)} size={14} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[9px] font-bold text-[#141413] truncate">Strategy Mind</p>
                    <span className="text-[8px] font-mono text-[#8e8b82] uppercase tracking-wider block leading-none">
                      {validationStatus === 'completed' ? '✓ Complete' : validationStatus === 'running' ? '● Active' : 'Waiting'}
                    </span>
                  </div>
                </div>

                {/* Finance Mind Node */}
                <div className="flex items-center gap-2 px-3 py-1 bg-white/95 border border-[#E9E2D9] rounded-lg shadow-3xs w-36">
                  <NeuralSymbol state={getNodeState(verdictStatus)} size={14} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[9px] font-bold text-[#141413] truncate">Finance Mind</p>
                    <span className="text-[8px] font-mono text-[#8e8b82] uppercase tracking-wider block leading-none">
                      {verdictStatus === 'completed' ? '✓ Complete' : verdictStatus === 'running' ? '● Active' : 'Waiting'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Right Column: Verdict Engine */}
              <div className="flex flex-col items-center gap-1.5 w-24 text-center">
                <div className={`w-10 h-10 rounded-full bg-white border flex items-center justify-center shadow-xs transition-all duration-300 ${
                  isFinished ? 'border-[#5db872] bg-[#F5F9F6]' : verdictStatus === 'running' ? 'border-[#7B61FF] scale-105 ring-2 ring-[#7B61FF]/10' : 'border-[#E9E2D9]'
                }`}>
                  <NeuralSymbol 
                    state={isFinished ? 'completed' : verdictStatus === 'running' ? 'generating_verdict' : 'idle'} 
                    size={22} 
                  />
                </div>
                <div className="min-w-0">
                  <span className="text-[9px] font-bold text-[#141413] tracking-wide uppercase font-mono block">
                    Verdict Engine
                  </span>
                  <span className={`text-[8px] font-mono font-semibold block leading-none ${
                    isFinished ? 'text-[#5db872]' : verdictStatus === 'running' ? 'text-[#7B61FF] animate-pulse' : 'text-[#8e8b82]'
                  }`}>
                    {isFinished ? 'Verdict Set' : verdictStatus === 'running' ? 'Synthesizing...' : 'Waiting'}
                  </span>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* DEBATE VIEW */}
        {activeView === 'debate' && (
          <div className="w-full space-y-2.5 animate-fadeIn max-h-[220px] overflow-y-auto pr-1">
            {debatePoints.map((point, i) => {
              const isPulsing = point.time === 'Active';
              
              let actionBadge = '';
              let badgeColor = '';
              if (point.action === 'challenging') {
                actionBadge = 'Challenging';
                badgeColor = 'bg-rose-50 text-rose-700 border-rose-100';
              } else if (point.action === 'validating' || point.action === 'validated') {
                actionBadge = 'Validating';
                badgeColor = 'bg-emerald-50 text-emerald-700 border-emerald-100';
              } else if (point.action === 'synthesizing') {
                actionBadge = 'Synthesizing';
                badgeColor = 'bg-purple-50 text-purple-700 border-purple-100';
              } else {
                actionBadge = 'Contributing';
                badgeColor = 'bg-amber-50 text-amber-700 border-amber-100';
              }

              return (
                <div key={i} className="bg-white/80 border border-[#E9E2D9] rounded-lg p-2.5 shadow-3xs flex flex-col gap-1.5 hover:bg-white transition-all">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <NeuralSymbol 
                        state={point.time === 'Waiting' ? 'queued' : point.time === 'Active' ? 'execution' : 'completed'} 
                        size={12} 
                      />
                      <span className="text-[10px] font-bold text-[#141413] font-lora">
                        {point.mind}
                      </span>
                      <span className="text-[8px] text-neutral-400 font-mono">
                        ({point.role})
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span className={`text-[8px] font-mono border px-1.5 py-0.5 rounded font-bold uppercase tracking-wide leading-none ${badgeColor}`}>
                        {actionBadge}
                      </span>
                      <span className={`text-[8px] font-mono text-neutral-400 ${isPulsing ? 'animate-pulse text-[#7B61FF] font-bold' : ''}`}>
                        {point.time}
                      </span>
                    </div>
                  </div>
                  <p className="text-[10.5px] leading-relaxed text-[#5E5B56] font-lora italic select-text">
                    "{point.opinion}"
                  </p>
                </div>
              );
            })}
          </div>
        )}

        {/* CONSENSUS VIEW */}
        {activeView === 'consensus' && (
          <div className="w-full space-y-4 animate-fadeIn">
            {/* Gauge Row */}
            <div className="bg-[#F4F0EB]/50 border border-[#E9E2D9] rounded-xl p-3.5 flex flex-col sm:flex-row items-center gap-4 justify-between">
              
              <div className="flex items-center gap-3">
                {/* Circular Gauge Placeholder/SVG */}
                <div className="relative w-12 h-12 flex items-center justify-center shrink-0">
                  <svg className="w-full h-full transform -rotate-90">
                    <circle cx="24" cy="24" r="21" stroke="#E9E2D9" strokeWidth="3.5" fill="transparent" />
                    <circle 
                      cx="24" 
                      cy="24" 
                      r="21" 
                      stroke={consensusScore === 100 ? '#5db872' : '#7B61FF'} 
                      strokeWidth="3.5" 
                      fill="transparent" 
                      strokeDasharray="132"
                      strokeDashoffset={132 - (132 * consensusScore) / 100}
                      className="transition-all duration-1000 ease-out"
                    />
                  </svg>
                  <span className={`absolute text-[10px] font-mono font-bold ${consensusScore === 100 ? 'text-[#5db872]' : 'text-[#7B61FF]'}`}>
                    {consensusScore}%
                  </span>
                </div>

                <div>
                  <h5 className="text-[10px] font-bold text-[#141413] tracking-wide uppercase font-mono">
                    Consensus Convergence Score
                  </h5>
                  <p className="text-[9px] text-[#5E5B56] leading-tight mt-0.5">
                    {consensusScore === 100 
                      ? 'Verdict successfully finalized. Alignment complete.' 
                      : consensusScore >= 80 
                        ? 'Verdict Engine resolving final analytical conflicts...' 
                        : 'Minds are actively deliberating GTM criteria...'}
                  </p>
                </div>
              </div>

              <div className="text-right shrink-0">
                <span className="text-[8px] font-mono text-[#8e8b82] uppercase block tracking-wider font-semibold">Evidence Confidence</span>
                <span className="text-xs font-mono font-bold text-[#cc785c]">94% (High Integrity)</span>
              </div>
            </div>

            {/* Verification Steps List */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[9.5px] font-mono text-[#5E5B56]">
              <div className="flex items-center justify-between p-2 rounded-lg bg-white border border-[#E9E2D9]/60">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#5db872] shrink-0" />
                  <span>Specialized viewpoints analyzed</span>
                </span>
                <span className="text-[#5db872] font-bold">YES</span>
              </div>

              <div className="flex items-center justify-between p-2 rounded-lg bg-white border border-[#E9E2D9]/60">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#5db872] shrink-0" />
                  <span>Competitor landscape validated</span>
                </span>
                <span className="text-[#5db872] font-bold">YES</span>
              </div>

              <div className="flex items-center justify-between p-2 rounded-lg bg-white border border-[#E9E2D9]/60">
                <span className="flex items-center gap-1.5">
                  {validationStatus === 'completed' ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#5db872] shrink-0" />
                  ) : (
                    <Loader2 className="w-3.5 h-3.5 text-[#7B61FF] animate-spin shrink-0" />
                  )}
                  <span>Peer-to-peer challenge resolved</span>
                </span>
                <span className={validationStatus === 'completed' ? 'text-[#5db872] font-bold' : 'text-[#7B61FF] font-bold animate-pulse'}>
                  {validationStatus === 'completed' ? 'YES' : 'PENDING'}
                </span>
              </div>

              <div className="flex items-center justify-between p-2 rounded-lg bg-white border border-[#E9E2D9]/60">
                <span className="flex items-center gap-1.5">
                  {verdictStatus === 'completed' ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#5db872] shrink-0" />
                  ) : (
                    <Loader2 className="w-3.5 h-3.5 text-[#7B61FF] animate-pulse shrink-0" />
                  )}
                  <span>Verdict Arbiter final vote</span>
                </span>
                <span className={verdictStatus === 'completed' ? 'text-[#5db872] font-bold' : 'text-[#8e8b82] font-bold'}>
                  {verdictStatus === 'completed' ? 'YES' : 'WAITING'}
                </span>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
