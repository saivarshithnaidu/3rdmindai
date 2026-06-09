'use client';

import React, { useState } from 'react';
import LiveFeed from './LiveFeed';
import { useStream } from '../../hooks/useStream';
import { ToggleLeft, ToggleRight, Radio, Trash2, ArrowDownCircle } from 'lucide-react';

interface LiveStreamPanelProps {
  projectId: string;
}

export default function LiveStreamPanel({ projectId }: LiveStreamPanelProps) {
  const { events, connected, clearEvents } = useStream(projectId);
  const [pauseScroll, setPauseScroll] = useState(false);

  return (
    <div className="w-full h-full flex flex-col bg-canvas font-dmsans select-none">
      
      {/* Header bar controls */}
      <div className="p-4 border-b border-hairline flex items-center justify-between shrink-0 bg-surface-soft/40">
        <div>
          <h3 className="font-serif text-sm font-bold text-ink flex items-center gap-1.5">
            <Radio className="w-4 h-4 text-[#cc785c]" />
            <span>Agent Operations Log</span>
          </h3>
          <p className="text-[10px] text-muted-soft mt-0.5">Live execution telemetry feed.</p>
        </div>

        <div className="flex items-center gap-2">
          {/* Pause / Resume Scroll control button */}
          <button
            onClick={() => setPauseScroll(!pauseScroll)}
            className="flex items-center gap-1 text-[10px] font-bold text-muted hover:text-ink transition-colors cursor-pointer bg-canvas px-2 py-1 rounded border border-hairline"
            title={pauseScroll ? 'Resume Auto Scroll' : 'Pause Auto Scroll'}
          >
            <ArrowDownCircle className={`w-3.5 h-3.5 ${pauseScroll ? 'text-muted-soft' : 'text-[#cc785c]'}`} />
            <span>{pauseScroll ? 'Paused' : 'Auto'}</span>
          </button>
        </div>
      </div>

      {/* Body Feed - fills remaining space */}
      <div className="flex-1 overflow-hidden p-4">
        <LiveFeed 
          projectId={projectId} 
          maxHeight="calc(100vh - 200px)" 
          compact={false}
        />
      </div>

      {/* Footer Metrics */}
      <div className="p-3 bg-surface-soft/40 border-t border-hairline flex items-center justify-between text-[10px] text-muted-soft shrink-0">
        <span>Session Statistics</span>
        <span className="font-bold text-ink">
          {events.length} events logged this session
        </span>
      </div>
    </div>
  );
}
