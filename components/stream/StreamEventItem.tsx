'use client';

import React, { useState } from 'react';
import { StreamEvent, StreamEventType } from '../../types';
import { 
  Check, 
  AlertTriangle, 
  ArrowRight, 
  Globe, 
  Terminal, 
  Layers, 
  Mail, 
  Database,
  Search,
  CheckCircle,
  Eye,
  EyeOff
} from 'lucide-react';

interface StreamEventItemProps {
  event: StreamEvent;
  compact?: boolean;
}

function formatRelativeTime(timestampStr: string): string {
  const diff = Date.now() - new Date(timestampStr).getTime();
  const secs = Math.max(0, Math.floor(diff / 1000));
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  return `${hours}h ago`;
}

export default function StreamEventItem({ event, compact = false }: StreamEventItemProps) {
  const [expanded, setExpanded] = useState(false);

  // 1. Color coding left border/styling
  let borderStyle = 'border-l-2 border-[#E5E0DA]';
  const isOrchestratorEvent = event.type.startsWith('ORCHESTRATOR_');
  const isAgentEvent = event.type.startsWith('AGENT_') && event.type !== 'AGENT_MESSAGE_SENT' && event.type !== 'AGENT_MESSAGE_RECEIVED' && event.type !== 'AGENT_TASK_QUEUED';

  if (isOrchestratorEvent) {
    borderStyle = 'border-l-2 border-[#5db8a6]'; // teal/blue
  } else if (isAgentEvent) {
    const role = event.agentRole?.toLowerCase();
    if (role === 'ceo') borderStyle = 'border-l-2 border-blue-500';
    else if (role === 'cmo') borderStyle = 'border-l-2 border-purple-500';
    else if (role === 'cto') borderStyle = 'border-l-2 border-teal-500';
    else if (role === 'cfo') borderStyle = 'border-l-2 border-amber-500';
    else if (role === 'cso') borderStyle = 'border-l-2 border-rose-500';
    else if (role === 'cro') borderStyle = 'border-l-2 border-green-500';
    else borderStyle = 'border-l-2 border-[#8e8b82]';
  } else if (event.type.startsWith('TOOL_')) {
    borderStyle = 'border-l-2 border-transparent';
  } else if (event.type.startsWith('BROWSER_')) {
    borderStyle = 'border-l-2 border-transparent';
  } else if (event.type === 'JUDGE_PASSED') {
    borderStyle = 'border-l-2 border-[#5db872]';
  } else if (event.type === 'JUDGE_FAILED' || event.type === 'JUDGE_REVISION') {
    borderStyle = 'border-l-2 border-[#d4a017]';
  } else if (event.type.startsWith('MEMORY_')) {
    borderStyle = 'border-l-2 border-[#8e8b82]/40';
  } else if (event.type.startsWith('PRICE_')) {
    borderStyle = 'border-l-2 border-[#e8a55a]';
  } else if (event.type.startsWith('EMAIL_')) {
    borderStyle = 'border-l-2 border-blue-400';
  } else if (event.type.startsWith('AD_') || event.type.startsWith('ADS_')) {
    borderStyle = 'border-l-2 border-purple-400';
  }

  // 2. Custom icons & layouts based on event types
  const renderItemContent = () => {
    switch (event.type) {
      case StreamEventType.AGENT_STARTED:
      case StreamEventType.AGENT_COMPLETE:
      case StreamEventType.AGENT_FAILED: {
        const role = event.agentRole?.toLowerCase();
        let circleBg = 'bg-gray-400';
        if (role === 'ceo') circleBg = 'bg-blue-500';
        else if (role === 'cmo') circleBg = 'bg-purple-500';
        else if (role === 'cto') circleBg = 'bg-teal-500';
        else if (role === 'cfo') circleBg = 'bg-amber-500';
        else if (role === 'cso') circleBg = 'bg-rose-500';
        else if (role === 'cro') circleBg = 'bg-green-500';

        return (
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${circleBg}`} />
            <span className="font-extrabold text-ink">{event.agentName || 'Agent'}</span>
            <span className="text-body font-medium">{event.title}</span>
            {event.status && (
              <span className={`text-[9px] uppercase px-1.5 py-0.5 rounded-full font-bold ml-1.5 ${
                event.status === 'done' ? 'bg-green-50 text-green-700 border border-green-200' :
                event.status === 'error' ? 'bg-red-50 text-red-700 border border-red-200' :
                'bg-amber-50 text-amber-700 border border-amber-200'
              }`}>
                {event.status === 'done' ? 'done' : event.status === 'error' ? 'failed' : 'working...'}
              </span>
            )}
          </div>
        );
      }

      case StreamEventType.TOOL_CALLING:
      case StreamEventType.TOOL_RESULT:
      case StreamEventType.TOOL_FAILED: {
        const isCalling = event.type === StreamEventType.TOOL_CALLING;
        const isSuccess = event.type === StreamEventType.TOOL_RESULT;
        return (
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-amber-500 font-bold shrink-0">⚡</span>
              <span className="font-mono text-[11px] bg-surface-soft border border-hairline px-1.5 py-0.5 rounded text-ink font-semibold">
                {event.data?.tool as string || event.title}
              </span>
              {event.detail && (
                <span className="text-[10px] text-muted bg-[#F4F0EB] px-2 py-0.5 rounded-full">
                  {event.detail}
                </span>
              )}
              {isSuccess && typeof event.data?.duration_ms === 'number' && (
                <span className="text-[10px] text-muted-soft">({event.data.duration_ms as number}ms)</span>
              )}
              {!!(event.data?.params || event.data?.resultPreview) && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
                  className="p-0.5 hover:bg-surface-cream-strong rounded text-muted hover:text-ink transition-colors cursor-pointer"
                >
                  {expanded ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              )}
            </div>

            {expanded && (
              <div className="bg-surface-soft border border-hairline rounded-lg p-2 mt-1 space-y-1.5 overflow-x-auto font-mono text-[10px] text-[#5e5b56]">
                {!!event.data?.params && (
                  <div>
                    <div className="font-bold text-ink">Arguments:</div>
                    <pre className="whitespace-pre-wrap">{JSON.stringify(event.data.params, null, 2)}</pre>
                  </div>
                )}
                {!!event.data?.resultPreview && (
                  <div>
                    <div className="font-bold text-ink">Result:</div>
                    <pre className="whitespace-pre-wrap">{event.data.resultPreview as string}</pre>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      }

      case StreamEventType.BROWSER_ROW_FOUND: {
        const progress = event.progress !== undefined ? event.progress : null;
        return (
          <div className="space-y-1">
            <div className="flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5 text-[#cc785c]" />
              <span className="text-body font-semibold">{event.title}</span>
              {event.detail && <span className="text-muted-soft">({event.detail})</span>}
            </div>
            {progress !== null && (
              <div className="w-32 h-1 bg-surface-soft rounded-full overflow-hidden mt-1">
                <div style={{ width: `${progress}%` }} className="h-full bg-[#cc785c] transition-all duration-300" />
              </div>
            )}
          </div>
        );
      }

      case StreamEventType.BROWSER_NAVIGATING:
      case StreamEventType.BROWSER_SEARCHING:
      case StreamEventType.BROWSER_EXTRACTING: {
        return (
          <div className="flex items-center gap-1.5">
            <Globe className="w-3.5 h-3.5 text-blue-500" />
            <span className="text-body font-medium">{event.title}</span>
            {event.detail && <span className="text-muted-soft truncate max-w-[200px]">{event.detail}</span>}
          </div>
        );
      }

      case StreamEventType.JUDGE_PASSED:
      case StreamEventType.JUDGE_FAILED:
      case StreamEventType.JUDGE_REVISION: {
        const isPass = event.type === StreamEventType.JUDGE_PASSED;
        const score = event.data?.score !== undefined ? `${event.data.score}/50` : '';

        return (
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5">
              {isPass ? (
                <Check className="w-3.5 h-3.5 text-green-600 bg-green-50 border border-green-300 rounded-full p-0.5 shrink-0" />
              ) : (
                <AlertTriangle className="w-3.5 h-3.5 text-[#d4a017] shrink-0" />
              )}
              <span className="font-extrabold text-ink">Quality Evaluation</span>
              <span className="text-body">{event.title}</span>
              {score && (
                <span className={`px-1.5 py-0.5 rounded font-bold text-[10px] ${isPass ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
                  {score}
                </span>
              )}
              {event.detail && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
                  className="p-0.5 hover:bg-surface-cream-strong rounded text-muted hover:text-ink transition-colors cursor-pointer"
                >
                  {expanded ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              )}
            </div>

            {expanded && event.detail && (
              <div className="bg-surface-soft border border-hairline rounded-lg p-2.5 mt-1 text-[11px] text-body italic leading-relaxed whitespace-pre-wrap">
                {event.detail}
              </div>
            )}
          </div>
        );
      }

      case StreamEventType.AGENT_MESSAGE_SENT: {
        return (
          <div className="flex items-start gap-1.5">
            <ArrowRight className="w-3.5 h-3.5 text-[#cc785c] mt-0.5 shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="font-bold text-ink truncate">
                {event.title}
              </div>
              {event.detail && (
                <p className="text-[11px] text-muted-soft truncate mt-0.5">&ldquo;{event.detail}&rdquo;</p>
              )}
            </div>
          </div>
        );
      }

      case StreamEventType.PRICE_TARGET_HIT: {
        return (
          <div className="flex items-center gap-1.5">
            <span className="text-base">🎯</span>
            <span className="font-extrabold text-[#5db872]">{event.title}</span>
            {event.detail && <span className="text-xs text-muted-soft">({event.detail})</span>}
            <span className="bg-green-50 text-green-700 border border-green-200 text-[8px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider">
              Alert Sent
            </span>
          </div>
        );
      }

      case StreamEventType.EMAIL_SENT: {
        return (
          <div className="flex items-start gap-2">
            <Mail className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
            <div>
              <span className="font-extrabold text-ink">{event.title}</span>
              {event.detail && <p className="text-[11px] text-muted-soft mt-0.5">{event.detail}</p>}
            </div>
          </div>
        );
      }

      case StreamEventType.AD_FOUND: {
        const pBadge = event.data?.platform as string || 'meta';
        return (
          <div className="flex items-start gap-2">
            <Layers className="w-3.5 h-3.5 text-purple-500 mt-0.5 shrink-0" />
            <div>
              <span className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded border mr-1.5 ${
                pBadge === 'google' 
                  ? 'bg-blue-50 text-blue-700 border-blue-200' 
                  : 'bg-purple-50 text-purple-700 border-purple-200'
              }`}>
                {pBadge}
              </span>
              <span className="text-body font-medium">{event.title}</span>
            </div>
          </div>
        );
      }

      case StreamEventType.CANVAS_ROW_ADDED: {
        return (
          <div className="flex items-center gap-1.5">
            <Database className="w-3.5 h-3.5 text-[#cc785c]" />
            <span className="text-body font-medium">{event.title}</span>
            {event.detail && <span className="text-muted-soft truncate max-w-[200px]">{event.detail}</span>}
          </div>
        );
      }

      case StreamEventType.STREAM_ERROR: {
        return (
          <div className="bg-red-50 border border-red-200 rounded-lg p-2 flex items-center gap-2 text-red-700">
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
            <span className="font-bold">{event.title}</span>
            {event.detail && <span className="text-[11px]">({event.detail})</span>}
          </div>
        );
      }

      default: {
        return (
          <div className="flex items-start gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-slate-400 mt-1.5 shrink-0" />
            <div className="min-w-0 flex-1">
              <span className="text-body font-medium">{event.title}</span>
              {event.detail && (
                <p className="text-[11px] text-muted-soft leading-normal mt-0.5">{event.detail}</p>
              )}
            </div>
          </div>
        );
      }
    }
  };

  return (
    <div 
      className={`pl-3 pr-2 py-2 border-b border-[#F0EBE5]/65 flex justify-between gap-4 transition-all duration-200 hover:bg-[#F4F0EB]/35 text-xs text-left ${borderStyle}`}
    >
      <div className="min-w-0 flex-1">
        {renderItemContent()}
      </div>
      <div className="shrink-0 text-[10px] text-muted-soft text-right font-mono whitespace-nowrap self-start mt-0.5">
        {formatRelativeTime(event.timestamp)}
      </div>
    </div>
  );
}
