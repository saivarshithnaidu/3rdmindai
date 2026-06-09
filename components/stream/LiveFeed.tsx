'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useStream } from '../../hooks/useStream';
import StreamEventItem from './StreamEventItem';
import { Trash2, Radio, AlertCircle } from 'lucide-react';
import { StreamEventType } from '../../types';

interface LiveFeedProps {
  projectId: string;
  filterAgentId?: string;
  filterTypes?: StreamEventType[];
  maxHeight?: string;
  compact?: boolean;
}

export default function LiveFeed({ 
  projectId, 
  filterAgentId, 
  filterTypes,
  maxHeight = '400px', 
  compact = false 
}: LiveFeedProps) {
  const { events, connected, clearEvents } = useStream(projectId);
  const [autoScroll, setAutoScroll] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  // Filter events by agentId and/or types if provided
  let filteredEvents = events;
  if (filterAgentId) {
    filteredEvents = filteredEvents.filter((e) => e.agentId === filterAgentId);
  }
  if (filterTypes) {
    filteredEvents = filteredEvents.filter((e) => filterTypes.includes(e.type));
  }

  // Auto-scroll logic
  const handleScroll = () => {
    const container = containerRef.current;
    if (container) {
      // If user is within 30px of bottom, keep autoScroll true
      const isAtBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 30;
      setAutoScroll(isAtBottom);
    }
  };

  useEffect(() => {
    if (autoScroll && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [filteredEvents, autoScroll]);

  return (
    <div className="w-full bg-[#FFFFFF] border border-[#E5E0DA] rounded-2xl flex flex-col overflow-hidden font-dmsans shadow-2xs">
      
      {/* Top Header Connection Status Indicator bar */}
      <div className="px-4 py-2.5 bg-surface-soft border-b border-hairline flex items-center justify-between shrink-0">
        <div className="flex items-center gap-1.5 text-xs text-ink font-bold uppercase tracking-wider">
          <Radio className="w-3.5 h-3.5 text-[#cc785c]" />
          <span>Realtime Stream Feed</span>
        </div>

        <div className="flex items-center gap-2">
          {/* Status Dot indicator */}
          <div className="flex items-center gap-1.5 text-[10px] font-semibold">
            <span className={`w-2 h-2 rounded-full shrink-0 ${connected ? 'bg-[#5db872] animate-pulse' : 'bg-gray-400'}`} />
            <span className={connected ? 'text-[#2f7e70]' : 'text-muted-soft'}>
              {connected ? 'Live' : 'Reconnecting...'}
            </span>
          </div>

          {filteredEvents.length > 0 && (
            <button
              onClick={clearEvents}
              className="p-1 hover:bg-surface-cream-strong rounded text-muted hover:text-ink transition-colors cursor-pointer"
              title="Clear Local Feed Logs"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Events scroll window view */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        style={{ maxHeight }}
        className="flex-1 overflow-y-auto divide-y divide-[#F0EBE5]/65 no-scrollbar scroll-smooth"
      >
        {filteredEvents.map((e) => (
          <StreamEventItem key={e.id} event={e} compact={compact} />
        ))}

        {filteredEvents.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center text-xs text-muted-soft italic space-y-1.5">
            <AlertCircle className="w-5 h-5 text-muted-soft" />
            <span>No events streamed in this workspace session yet.</span>
          </div>
        )}
      </div>
    </div>
  );
}
