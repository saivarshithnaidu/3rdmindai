'use client';

import React from 'react';
import NeuralSymbol from './NeuralSymbol';

interface OrchestrationTimelineProps {
  agents?: any[];
  isFinished?: boolean;
}

export default function OrchestrationTimeline({ agents = [], isFinished = false }: OrchestrationTimelineProps) {
  // Define the five core orchestration stages
  const stages = [
    { key: 'objective', label: 'Objective Analysis' },
    { key: 'assignment', label: 'Mind Assignment' },
    { key: 'research', label: 'Research Phase' },
    { key: 'validation', label: 'Validation Phase' },
    { key: 'verdict', label: 'Verdict Generation' }
  ];

  // Resolve statuses dynamically based on the current agents status tree
  let researchStatus: 'completed' | 'running' | 'waiting' | 'failed' = 'completed';
  let validationStatus: 'completed' | 'running' | 'waiting' | 'failed' = 'waiting';
  let verdictStatus: 'completed' | 'running' | 'waiting' | 'failed' = 'waiting';

  if (isFinished) {
    researchStatus = 'completed';
    validationStatus = 'completed';
    verdictStatus = 'completed';
  } else {
    const subagents = agents.filter(a => a.type === 'subagent');
    
    if (subagents.length === 0) {
      // Planning stage
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
        // Research Status
        const runningResearch = researchAgents.some(a => a.status === 'running');
        const allResearchDone = researchAgents.length > 0 && researchAgents.every(a => a.status === 'done');
        
        if (runningResearch) {
          researchStatus = 'running';
        } else if (allResearchDone || validationAgents.some(a => a.status === 'running' || a.status === 'done')) {
          researchStatus = 'completed';
        } else {
          researchStatus = 'running'; // fallback active
        }

        // Validation Status
        const runningValidation = validationAgents.some(a => a.status === 'running');
        const allValidationDone = validationAgents.length > 0 && validationAgents.every(a => a.status === 'done');
        
        if (runningValidation) {
          validationStatus = 'running';
        } else if (allValidationDone || verdictAgents.some(a => a.status === 'running' || a.status === 'done')) {
          validationStatus = 'completed';
        } else if (researchStatus === 'completed') {
          validationStatus = 'running'; // validate next
        } else {
          validationStatus = 'waiting';
        }

        // Verdict Status
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

  const getStageStatus = (key: string) => {
    if (key === 'objective' || key === 'assignment') return 'completed';
    if (key === 'research') return researchStatus;
    if (key === 'validation') return validationStatus;
    return verdictStatus;
  };

  const getStageSymbolState = (status: string) => {
    if (status === 'completed') return 'completed';
    if (status === 'failed') return 'failed';
    if (status === 'running') return 'execution';
    return 'idle';
  };

  return (
    <div className="w-full border border-[#E9E2D9] bg-[#FBF9F6]/40 rounded-xl p-3 mb-4 select-none">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-2">
        {stages.map((stage, i) => {
          const status = getStageStatus(stage.key);
          const symbolState = getStageSymbolState(status);
          
          return (
            <React.Fragment key={stage.key}>
              <div className="flex items-center gap-2.5 flex-1 min-w-0">
                <NeuralSymbol state={symbolState} size={16} className="shrink-0" />
                <div className="min-w-0">
                  <div className="text-[10px] font-bold text-[#141413] tracking-wide uppercase font-mono truncate">
                    {stage.label}
                  </div>
                  <div className={`text-[8px] font-mono font-bold mt-0.5 uppercase tracking-wider ${
                    status === 'completed' ? 'text-[#5db872]' :
                    status === 'running' ? 'text-[#7B61FF] animate-pulse' :
                    status === 'failed' ? 'text-[#c64545]' :
                    'text-[#8e8b82]'
                  }`}>
                    {status === 'completed' ? '✓ Complete' :
                     status === 'running' ? '● Active' :
                     status === 'failed' ? '✕ Failed' :
                     '○ Waiting'}
                  </div>
                </div>
              </div>
              {i < stages.length - 1 && (
                <div className="hidden md:block w-8 h-[1px] bg-[#E9E2D9] shrink-0" />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
