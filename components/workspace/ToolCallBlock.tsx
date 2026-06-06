'use client';

import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp, CheckCircle2, XCircle, Zap, Clock, Terminal } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface ToolCallBlockProps {
  content: string;
  projectId: string;
  agentId: string;
}

interface ParsedToolCall {
  toolName: string;
  status: 'done' | 'error';
  result: Record<string, unknown> | string;
  durationMs?: number;
  params?: Record<string, unknown>;
}

export default function ToolCallBlock({ content, projectId, agentId }: ToolCallBlockProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [toolCalls, setToolCalls] = useState<ParsedToolCall[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Parse tool calls from the raw message text
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
          // fallback to raw string
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

    // 2. Fetch tool_calls database records for richer details (e.g. parameters and exact duration)
    const fetchDbDetails = async () => {
      try {
        const response = await fetch(`/api/tool-calls?projectId=${projectId}&agentId=${agentId}`);
        if (response.ok) {
          const dbCalls = await response.json();
          
          // Merge DB details (params and duration) into our parsed tool calls
          const merged = parsed.map((item) => {
            // Find a match in the DB by tool name in reverse order (newest first)
            const match = [...dbCalls]
              .reverse()
              .find((dbCall: any) => dbCall.tool_name === item.toolName);
            
            if (match) {
              return {
                ...item,
                params: match.params,
                durationMs: match.duration_ms,
                status: (match.status === 'error' ? 'error' : 'done') as 'done' | 'error',
              };
            }
            return item;
          });
          setToolCalls(merged);
        } else {
          setToolCalls(parsed);
        }
      } catch (err) {
        console.warn('Failed to query database tool logs, using text parse fallback:', err);
        setToolCalls(parsed);
      } finally {
        setLoading(false);
      }
    };

    if (parsed.length > 0) {
      fetchDbDetails();
    } else {
      setLoading(false);
    }
  }, [content, projectId, agentId]);

  if (toolCalls.length === 0) {
    // If not a tool call message, return fallback plain message style
    return (
      <div className="bg-surface-soft border border-hairline text-muted px-4 py-2.5 rounded-xl text-xs max-w-[85%] leading-relaxed shadow-2xs font-mono">
        {content}
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto my-3 font-dmsans select-none animate-fadeIn">
      <div className="border border-hairline bg-canvas rounded-xl overflow-hidden shadow-2xs">
        {/* Accordion Header */}
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center justify-between px-4 py-3 bg-surface-card hover:bg-surface-cream-strong transition-colors cursor-pointer text-left"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <Zap className="w-4 h-4 text-primary" />
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-bold text-ink truncate">
                {toolCalls.length} External tool call{toolCalls.length > 1 ? 's' : ''} executed
              </span>
              <span className="text-[10px] text-muted-soft font-semibold">
                {toolCalls.map(t => t.toolName).join(', ')}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {toolCalls.some(t => t.status === 'error') ? (
              <span className="text-[10px] text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full font-bold">
                Failed
              </span>
            ) : (
              <span className="text-[10px] text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full font-bold">
                Completed
              </span>
            )}
            {isExpanded ? (
              <ChevronUp className="w-4 h-4 text-muted-soft" />
            ) : (
              <ChevronDown className="w-4 h-4 text-muted-soft" />
            )}
          </div>
        </button>

        {/* Accordion Body */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="border-t border-hairline bg-canvas divide-y divide-hairline-soft"
            >
              {toolCalls.map((tc, idx) => (
                <div
                  key={idx}
                  className={`p-4 flex flex-col gap-3 border-l-4 ${
                    tc.status === 'error' ? 'border-red-500 bg-red-50/10' : 'border-green-500 bg-green-50/10'
                  }`}
                >
                  {/* Tool Header Details */}
                  <div className="flex items-center justify-between gap-3 text-xs font-bold text-ink">
                    <div className="flex items-center gap-2">
                      <Terminal className="w-3.5 h-3.5 text-muted" />
                      <span className="font-mono text-primary">{tc.toolName}</span>
                    </div>

                    <div className="flex items-center gap-3 text-[10px] text-muted-soft">
                      {tc.durationMs !== undefined && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {tc.durationMs}ms
                        </span>
                      )}
                      {tc.status === 'error' ? (
                        <span className="flex items-center gap-1 text-red-600">
                          <XCircle className="w-3.5 h-3.5" />
                          Failed
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-green-600">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Success
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Parameters Collapsible */}
                  {tc.params && (
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-muted-soft tracking-wider uppercase">
                        Parameters
                      </span>
                      <pre className="p-3 bg-surface-soft border border-hairline rounded-lg text-[10.5px] font-mono text-ink overflow-x-auto leading-relaxed max-h-40">
                        {JSON.stringify(tc.params, null, 2)}
                      </pre>
                    </div>
                  )}

                  {/* Execution Results */}
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-muted-soft tracking-wider uppercase">
                      Execution Result
                    </span>
                    <pre className={`p-3 border rounded-lg text-[10.5px] font-mono overflow-x-auto leading-relaxed max-h-60 ${
                      tc.status === 'error' 
                        ? 'bg-red-50/50 border-red-200 text-red-700' 
                        : 'bg-surface-soft border-hairline text-ink'
                    }`}>
                      {typeof tc.result === 'string' 
                        ? tc.result 
                        : JSON.stringify(tc.result, null, 2)
                      }
                    </pre>
                  </div>
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
