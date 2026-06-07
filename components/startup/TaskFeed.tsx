'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import supabaseService from '../../services/supabase.service';
import { AgentTask, AgentRole } from '../../types';
import ReactMarkdown from 'react-markdown';
import { ChevronDown, ChevronUp, Clock, Bot, Activity, Globe } from 'lucide-react';

interface TaskFeedProps {
  projectId: string;
  agentNames: Record<string, { name: string; role: AgentRole }>;
}

const roleColors: Record<AgentRole, string> = {
  ceo: 'bg-blue-50 text-blue-600 border-blue-200/50',
  cmo: 'bg-purple-50 text-purple-600 border-purple-200/50',
  cto: 'bg-teal-50 text-teal-600 border-teal-200/50',
  cfo: 'bg-amber-50 text-amber-600 border-amber-200/50',
  cso: 'bg-rose-50 text-rose-600 border-rose-200/50',
  cro: 'bg-green-50 text-green-600 border-green-200/50',
};

function formatTime(dateStr: string): string {
  const time = new Date(dateStr).getTime();
  const diff = Date.now() - time;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Date(dateStr).toLocaleDateString();
}

export default function TaskFeed({ projectId, agentNames }: TaskFeedProps) {
  const [tasks, setTasks] = useState<AgentTask[]>([]);
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = supabaseService.getClient();

    // 1. Initial Fetch
    const fetchTasks = async () => {
      try {
        const { data, error } = await supabase
          .from('agent_tasks')
          .select('*')
          .eq('project_id', projectId)
          .order('created_at', { ascending: false })
          .limit(50);

        if (error) throw error;
        setTasks(data || []);
      } catch (err) {
        console.error('Failed to load initial task feed:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchTasks();

    // 2. Setup Realtime Subscription
    const channel = supabase
      .channel(`live-agent-tasks-${projectId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'agent_tasks',
          filter: `project_id=eq.${projectId}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setTasks((prev) => [payload.new as AgentTask, ...prev.slice(0, 49)]);
          } else if (payload.eventType === 'UPDATE') {
            setTasks((prev) =>
              prev.map((t) => (t.id === payload.new.id ? (payload.new as AgentTask) : t))
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId]);

  const toggleExpand = (taskId: string) => {
    setExpandedTaskId(expandedTaskId === taskId ? null : taskId);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-[#5E5B56]">
        <Activity className="w-5 h-5 animate-pulse text-[#D97757] mb-2" />
        <span className="text-xs">Loading feed...</span>
      </div>
    );
  }

  return (
    <div className="bg-white border border-[#E5E0DA] rounded-3xl p-6 shadow-[0_4px_24px_rgba(25,25,25,0.01)] font-dmsans">
      <div className="flex items-center gap-2 mb-6">
        <div className="w-2 h-2 rounded-full bg-[#D97757] animate-ping" />
        <h2 className="text-sm font-extrabold uppercase tracking-wider text-[#191919]">Live activity</h2>
      </div>

      {tasks.length === 0 ? (
        <div className="text-center py-10 border border-dashed border-[#E5E0DA] rounded-2xl bg-[#FBF9F6]">
          <Bot className="w-8 h-8 text-[#85827D] mx-auto mb-2 opacity-50" />
          <p className="text-xs text-[#5E5B56] font-medium">No tasks logged for this team yet.</p>
        </div>
      ) : (
        <div className="divide-y divide-[#E5E0DA] -my-2.5">
          <AnimatePresence initial={false}>
            {tasks.map((task) => {
              const agent = agentNames[task.agent_id] || { name: 'Agent', role: 'ceo' };
              const colorClass = roleColors[agent.role] || 'bg-gray-50 text-gray-600 border-gray-200';
              const isExpanded = expandedTaskId === task.id;

              const usedBrowser = task.description?.includes('[LIVE SCRAPED DATA]');
              let browserDetails = '';
              if (usedBrowser) {
                const dataBlock = task.description.split('[LIVE SCRAPED DATA]')[1] || '';
                const lines = dataBlock.trim().split('\n').filter(l => l.trim().match(/^\d+\./));
                const count = lines.length;
                
                let scraperName = 'Web Browser';
                if (task.description.toLowerCase().includes('maps.google')) scraperName = 'Google Maps';
                else if (task.description.toLowerCase().includes('google.com/search')) scraperName = 'Google Search';
                else if (task.description.toLowerCase().includes('producthunt')) scraperName = 'Product Hunt';
                else if (task.description.toLowerCase().includes('twitter')) scraperName = 'Twitter / X';
                else if (task.description.toLowerCase().includes('ycombinator')) scraperName = 'Y Combinator';
                else if (task.description.toLowerCase().includes('http://') || task.description.toLowerCase().includes('https://')) scraperName = 'Generic Website';

                browserDetails = `Used browser: ${scraperName} — ${count} result${count !== 1 ? 's' : ''}`;
              }

              return (
                <motion.div
                  key={task.id}
                  layout="position"
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="py-4 flex flex-col gap-2.5"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      {/* Agent Badge */}
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border ${colorClass}`}>
                        {agent.role.toUpperCase()}
                      </span>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-extrabold text-[#191919]">{agent.name}</span>
                          <span className="text-xs text-[#5E5B56] font-medium">—</span>
                          <span className="text-xs text-[#191919] font-medium truncate max-w-[200px] sm:max-w-[320px]">
                            {task.title}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-[#85827D] mt-0.5 font-medium flex-wrap">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            <span>{formatTime(task.created_at)}</span>
                          </span>
                          {task.triggered_by && (
                            <>
                              <span className="text-[#E5E0DA]">•</span>
                              <span className="capitalize">via {task.triggered_by}</span>
                            </>
                          )}
                          {usedBrowser && (
                            <>
                              <span className="text-[#E5E0DA]">•</span>
                              <span className="inline-flex items-center gap-1 text-blue-600 bg-blue-50 border border-blue-100 rounded-sm px-1.5 py-0.5 text-[9px] font-bold select-none">
                                <Globe className="w-2.5 h-2.5" />
                                <span>{browserDetails}</span>
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5">
                      {/* Judge Score Badge */}
                      {task.judge_score !== null && task.judge_score !== undefined && (
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${
                          task.judge_score >= 35
                            ? 'text-green-600 bg-green-50 border-green-200'
                            : task.judge_score >= 20
                            ? 'text-amber-600 bg-amber-50 border-amber-200'
                            : 'text-red-600 bg-red-50 border-red-200'
                        }`}>
                          {task.judge_score}/50
                        </span>
                      )}

                      {/* Status - Text only, no dots */}
                      <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                        task.status === 'running'
                          ? 'text-blue-600 bg-blue-50 border border-blue-100'
                          : task.status === 'done'
                          ? 'text-green-600 bg-green-50 border border-green-100'
                          : task.status === 'queued'
                          ? 'text-amber-600 bg-amber-50 border border-amber-100'
                          : 'text-red-600 bg-red-50 border border-red-100' // failed
                      }`}>
                        {task.status}
                      </span>

                      {(task.status === 'done' || task.status === 'failed' || (task.status === 'running' && task.output)) && (
                        <button
                          type="button"
                          onClick={() => toggleExpand(task.id)}
                          className="p-1 hover:bg-[#F4F0EB] text-[#5E5B56] rounded-lg transition-colors cursor-pointer"
                        >
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Collapsible output details */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden bg-[#FBF9F6] border border-[#E5E0DA] rounded-2xl p-4 mt-1"
                      >
                        <div className="prose prose-sm max-w-none text-[#191919] prose-headings:font-lora prose-headings:font-bold prose-p:leading-relaxed text-xs">
                          {task.output ? (
                            <ReactMarkdown>{task.output}</ReactMarkdown>
                          ) : (
                            <p className="italic text-[#85827D]">Initializing execution stream...</p>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
