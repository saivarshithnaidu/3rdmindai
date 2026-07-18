'use client';

import React from 'react';
import { CodingSession } from '../../types/coding';

interface ExecutionPanelProps {
  session: CodingSession & {
    all_tests_passing?: boolean;
    execution_output?: string | null;
    fix_rounds?: number;
    sandbox_id?: string | null;
  };
  onRunExecution: () => void;
  isRunning: boolean;
}

export default function ExecutionPanel({
  session,
  onRunExecution,
  isRunning
}: ExecutionPanelProps) {
  const allTestsPassing = session?.all_tests_passing || false;
  const executionOutput = session?.execution_output || '';
  const fixRounds = session?.fix_rounds || 0;
  const status = session?.status;

  const getStatusIndicator = () => {
    if (isRunning || (status === 'running' && !allTestsPassing)) {
      return (
        <div className="flex items-center gap-2 text-amber-600 bg-amber-50 border border-amber-200 px-3.5 py-1.5 rounded-full text-xs font-bold animate-pulse">
          <i className="ti ti-loader animate-spin" />
          <span>Running inside E2B sandbox...</span>
        </div>
      );
    }
    if (status === 'failed') {
      return (
        <div className="flex items-center gap-2 text-red-700 bg-red-50 border border-red-200 px-3.5 py-1.5 rounded-full text-xs font-bold">
          <i className="ti ti-alert-triangle" />
          <span>Needs review (Failed to compile/pass tests)</span>
        </div>
      );
    }
    if (allTestsPassing) {
      return (
        <div className="flex items-center gap-2 text-green-700 bg-green-50 border border-green-200 px-3.5 py-1.5 rounded-full text-xs font-bold">
          <i className="ti ti-circle-check" />
          <span>All tests passing ✓</span>
        </div>
      );
    }
    return (
      <div className="flex items-center gap-2 text-[#5E5B56] bg-[#F4F0EB] border border-[#E5E0DA] px-3.5 py-1.5 rounded-full text-xs font-bold">
        <i className="ti ti-square" />
        <span>Idle</span>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-[#18181b] rounded-xl border border-zinc-800 text-zinc-100 font-mono text-[11px] overflow-hidden select-none">
      
      {/* Terminal Title Bar */}
      <div className="bg-zinc-900 border-b border-zinc-800 px-4 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
            <span className="w-2.5 h-2.5 rounded-full bg-green-500/80" />
          </div>
          <span className="text-zinc-400 font-medium ml-2">E2B Sandboxed Terminal</span>
        </div>

        <button
          onClick={onRunExecution}
          disabled={isRunning || status === 'running'}
          className="bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-zinc-200 hover:text-white border border-zinc-700 transition-colors px-3 py-1.5 rounded-md text-[10px] font-bold cursor-pointer"
        >
          Run Sandbox
        </button>
      </div>

      {/* Execution Status Indicators */}
      <div className="bg-zinc-950 p-4 border-b border-zinc-800 shrink-0 flex flex-wrap items-center justify-between gap-3 font-dmsans">
        {getStatusIndicator()}

        {fixRounds > 0 && (
          <div className="text-[10px] text-zinc-400 bg-zinc-900 px-3 py-1.5 rounded-md border border-zinc-800 flex items-center gap-1.5">
            <i className="ti ti-sparkles text-amber-500 animate-pulse" />
            <span>Self-healed in <strong>{fixRounds}</strong> {fixRounds === 1 ? 'round' : 'rounds'}</span>
          </div>
        )}
      </div>

      {/* Terminal logs */}
      <div className="flex-1 p-4 overflow-y-auto bg-zinc-950/40 text-zinc-300 leading-relaxed font-mono whitespace-pre-wrap select-text selection:bg-[#cc785c]/30 selection:text-white">
        {isRunning ? (
          <div className="flex items-center gap-2 text-zinc-500">
            <i className="ti ti-loader animate-spin" />
            Preparing sandbox environment...
          </div>
        ) : executionOutput ? (
          executionOutput
        ) : (
          <div className="text-zinc-600 italic select-none">
            No console output. Click "Run Sandbox" to execute files.
          </div>
        )}
      </div>
      
    </div>
  );
}
