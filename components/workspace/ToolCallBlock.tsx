'use client';

import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp, CheckCircle2, XCircle, Zap, Clock, Terminal } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { ALL_CONNECTORS } from '../../lib/connectors.registry';

interface ToolCallBlockProps {
  content?: string;
  projectId?: string;
  agentId?: string;
  toolCall?: any; // Single tool call record passed directly
}

interface ParsedToolCall {
  toolName: string;
  status: 'done' | 'error';
  result: Record<string, unknown> | string;
  durationMs?: number;
  params?: Record<string, unknown>;
  connectorSlug?: string;
  created_at?: string;
}

const Loader2 = ({ className }: { className?: string }) => (
  <svg className={`animate-spin ${className}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
  </svg>
);

export default function ToolCallBlock({ content, projectId, agentId, toolCall }: ToolCallBlockProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showFullResult, setShowFullResult] = useState(false);
  const [calls, setCalls] = useState<ParsedToolCall[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (toolCall) {
      setCalls([
        {
          toolName: toolCall.tool_name,
          status: toolCall.status === 'error' ? 'error' : 'done',
          result: toolCall.result || {},
          durationMs: toolCall.duration_ms || 0,
          params: toolCall.params || {},
          connectorSlug: toolCall.connector_slug || '',
          created_at: toolCall.created_at
        }
      ]);
      setLoading(false);
      return;
    }

    if (!content) {
      setLoading(false);
      return;
    }

    // Parse from content text
    const lines = content.split('\n');
    const parsed: ParsedToolCall[] = [];

    const resultRegex = /^\[TOOL CALL RESULT for tool "([^"]+)"]: (.*)$/;
    const errorRegex = /^\[TOOL CALL EXCEPTION for tool "([^"]+)"]: (.*)$/;

    for (const line of lines) {
      const trimmed = line.trim();
      const resMatch = trimmed.match(resultRegex);
      if (resMatch) {
        const toolName = resMatch[1];
        const jsonStr = resMatch[2];
        let resultObj: any = jsonStr;
        try {
          resultObj = JSON.parse(jsonStr);
        } catch (e) {
          // fallback
        }
        parsed.push({
          toolName,
          status: 'done',
          result: resultObj,
        });
        continue;
      }

      const errMatch = trimmed.match(errorRegex);
      if (errMatch) {
        const toolName = errMatch[1];
        const errorMsg = errMatch[2];
        parsed.push({
          toolName,
          status: 'error',
          result: errorMsg,
        });
      }
    }

    const fetchDbDetails = async () => {
      try {
        const response = await fetch(`/api/tool-calls?projectId=${projectId}&agentId=${agentId}`);
        if (response.ok) {
          const dbCalls = await response.json();
          const merged = parsed.map((item) => {
            const match = [...dbCalls]
              .reverse()
              .find((dbCall: any) => dbCall.tool_name === item.toolName);
            
            if (match) {
              return {
                ...item,
                params: match.params,
                durationMs: match.duration_ms,
                status: (match.status === 'error' ? 'error' : 'done') as 'done' | 'error',
                connectorSlug: match.connector_slug,
                created_at: match.created_at
              };
            }
            return item;
          });
          setCalls(merged);
        } else {
          setCalls(parsed);
        }
      } catch (err) {
        console.warn('Failed to query database tool logs:', err);
        setCalls(parsed);
      } finally {
        setLoading(false);
      }
    };

    if (parsed.length > 0) {
      fetchDbDetails();
    } else {
      setLoading(false);
    }
  }, [content, projectId, agentId, toolCall]);

  if (loading) {
    return (
      <div className="w-full max-w-4xl mx-auto my-3 flex items-center justify-center p-4 border border-hairline bg-canvas rounded-xl">
        <Loader2 className="w-4 h-4 animate-spin text-primary mr-2" />
        <span className="text-xs text-muted">Loading tool execution logs...</span>
      </div>
    );
  }

    // Removed Loader2 duplicate definition

  if (calls.length === 0) {
    if (content) {
      return (
        <div className="bg-surface-soft border border-hairline text-muted px-4 py-2.5 rounded-xl text-xs max-w-[85%] leading-relaxed shadow-2xs font-mono">
          {content}
        </div>
      );
    }
    return null;
  }

  return (
    <div className="w-full max-w-4xl mx-auto my-2.5 font-dmsans select-none animate-fadeIn">
      {calls.map((tc, index) => {
        const registryEntry = ALL_CONNECTORS.find(c => c.slug === tc.connectorSlug);
        const connectorName = registryEntry?.name || tc.connectorSlug || 'System';
        const isError = tc.status === 'error';
        
        // Format Result
        const resultString = typeof tc.result === 'string'
          ? tc.result
          : JSON.stringify(tc.result, null, 2);
        
        const isLongResult = resultString.length > 500;
        const displayedResult = isLongResult && !showFullResult
          ? resultString.slice(0, 500) + '\n... [truncated]'
          : resultString;

        return (
          <div
            key={index}
            className={`border border-hairline rounded-xl overflow-hidden shadow-2xs transition-all duration-200 border-l-4 ${
              isError ? 'border-l-error bg-error/5' : 'border-l-success bg-success/5'
            } mb-2.5 last:mb-0`}
          >
            {/* Collapsed Header */}
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="w-full flex items-center justify-between px-4 py-3 bg-surface-soft hover:bg-surface-cream-strong transition-colors cursor-pointer text-left"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <Zap className="w-4 h-4 text-primary shrink-0" />
                <div className="flex items-center gap-2 min-w-0">
                  <span className="px-2 py-0.5 rounded bg-surface-card border border-hairline text-ink font-bold text-[9px] uppercase tracking-wider shrink-0">
                    {connectorName}
                  </span>
                  <span className="font-mono text-xs text-body-strong truncate font-semibold">
                    {tc.toolName}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2.5 shrink-0">
                {isError ? (
                  <span className="text-[10px] text-error bg-red-50 border border-red-100 px-2 py-0.5 rounded-full font-bold">
                    Error
                  </span>
                ) : (
                  <span className="text-[10px] text-success bg-green-50 border border-green-100 px-2 py-0.5 rounded-full font-bold">
                    Success
                  </span>
                )}
                {isExpanded ? (
                  <ChevronUp className="w-4 h-4 text-muted-soft" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-muted-soft" />
                )}
              </div>
            </button>

            {/* Expanded Content */}
            <AnimatePresence>
              {isExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="border-t border-hairline bg-canvas p-4 space-y-4 text-xs"
                >
                  {/* Parameters */}
                  {tc.params && Object.keys(tc.params).length > 0 && (
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-muted-soft tracking-wider uppercase flex items-center gap-1">
                        <Terminal className="w-3 h-3" />
                        Parameters
                      </span>
                      <pre className="p-3 bg-surface-soft border border-hairline rounded-lg text-[10.5px] font-mono text-ink overflow-x-auto leading-relaxed max-h-40">
                        {JSON.stringify(tc.params, null, 2)}
                      </pre>
                    </div>
                  )}

                  {/* Execution Result */}
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-muted-soft tracking-wider uppercase">
                      Execution Result
                    </span>
                    <div className="relative">
                      <pre className={`p-3 border rounded-lg text-[10.5px] font-mono overflow-x-auto leading-relaxed max-h-60 ${
                        isError 
                          ? 'bg-red-50/30 border-red-200 text-error' 
                          : 'bg-surface-soft border-hairline text-ink'
                      }`}>
                        {displayedResult}
                      </pre>
                      {isLongResult && (
                        <button
                          type="button"
                          onClick={() => setShowFullResult(!showFullResult)}
                          className="mt-1 text-[10px] font-bold text-primary hover:underline cursor-pointer flex items-center gap-0.5"
                        >
                          {showFullResult ? 'Show less' : 'Show more'}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Footer metadata */}
                  <div className="flex items-center justify-between text-[10px] text-muted-soft pt-2 border-t border-hairline-soft font-semibold">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      Completed in {tc.durationMs || 0}ms
                    </span>
                    {tc.created_at && (
                      <span>{new Date(tc.created_at).toLocaleTimeString()}</span>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}
