'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { StartupAgent, AgentTask, AgentRole } from '../../types';
import supabaseService from '../../services/supabase.service';
import MemoryPanel from './MemoryPanel';
import MessagesPanel from './MessagesPanel';
import SchedulePanel from './SchedulePanel';
import JudgePanel from './JudgePanel';
import AnalyticsPanel from './AnalyticsPanel';
import OutreachTracker from './OutreachTracker';
import AgentBrowserSessionsPanel from './AgentBrowserSessionsPanel';
import ToolCallBlock from '../workspace/ToolCallBlock';
import ReactMarkdown from 'react-markdown';
import LiveFeed from '../stream/LiveFeed';
import TaskFeedback from '../learning/TaskFeedback';
import LearningPanel from '../learning/LearningPanel';
import { Play, Loader2, Brain, Mail, Settings, ChevronLeft, ChevronDown, ChevronUp, Bot, Sparkles, Check, ToggleLeft, ToggleRight, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface AgentWorkspaceProps {
  agentId: string;
  projectId: string;
  allProjects: any[];
}

const roleMeta: Record<AgentRole, { title: string; avatarBg: string; textClass: string }> = {
  ceo: { title: 'Chief Executive Officer', avatarBg: 'bg-blue-50 text-blue-600 border border-blue-200/50', textClass: 'text-blue-600' },
  cmo: { title: 'Chief Marketing Officer', avatarBg: 'bg-purple-50 text-purple-600 border border-purple-200/50', textClass: 'text-purple-600' },
  cto: { title: 'Chief Technology Officer', avatarBg: 'bg-teal-50 text-teal-600 border border-teal-200/50', textClass: 'text-teal-600' },
  cfo: { title: 'Chief Financial Officer', avatarBg: 'bg-amber-50 text-amber-600 border border-amber-200/50', textClass: 'text-amber-600' },
  cso: { title: 'Chief Sales Officer', avatarBg: 'bg-rose-50 text-rose-600 border border-rose-200/50', textClass: 'text-rose-600' },
  cro: { title: 'Chief Research Officer', avatarBg: 'bg-green-50 text-green-600 border border-green-200/50', textClass: 'text-green-600' },
};

const MODEL_OPTIONS = [
  { id: 'openai/gpt-4o', name: 'GPT-4o (Best Strategy)' },
  { id: 'google/gemini-pro-1.5', name: 'Gemini Pro 1.5 (Best Creative/Research)' },
  { id: 'deepseek/deepseek-chat', name: 'DeepSeek Chat (Best Technical/Analysis)' },
  { id: 'meta-llama/llama-3-70b-instruct', name: 'Llama 3 70b (Fast)' },
];

export default function AgentWorkspace({ agentId, projectId, allProjects }: AgentWorkspaceProps) {
  const router = useRouter();
  const [agent, setAgent] = useState<StartupAgent | null>(null);
  const [tasks, setTasks] = useState<AgentTask[]>([]);
  const [schedules, setSchedules] = useState<any[]>([]);
  const [quickTaskText, setQuickTaskText] = useState('');
  const [running, setRunning] = useState(false);
  const [runningOutput, setRunningOutput] = useState('');
  
  // Right sidebar tabs
  const [activeTab, setActiveTab] = useState<'memory' | 'messages' | 'browser' | 'judge' | 'analytics' | 'learning' | 'outreach' | 'settings'>('memory');
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Settings State
  const [editName, setEditName] = useState('');
  const [editModel, setEditModel] = useState('');
  const [editIsActive, setEditIsActive] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);

  const outputEndRef = useRef<HTMLDivElement>(null);

  const loadAgentAndTasks = async () => {
    try {
      const supabase = supabaseService.getClient();

      // Fetch specific agent
      const { data: agentData, error: agentErr } = await supabase
        .from('startup_agents')
        .select('*')
        .eq('id', agentId)
        .single();
      
      if (agentErr) throw agentErr;
      setAgent(agentData);
      setEditName(agentData.name);
      setEditModel(agentData.model);
      setEditIsActive(agentData.is_active);

      // Fetch tasks history
      const tasksRes = await fetch(`/api/startup-agents/tasks?agentId=${agentId}&limit=30`);
      if (tasksRes.ok) {
        const data = await tasksRes.json();
        setTasks(data.tasks || []);
      }

      // Fetch schedules list
      const schedsRes = await fetch(`/api/startup-agents/schedule?projectId=${projectId}`);
      if (schedsRes.ok) {
        const data = await schedsRes.json();
        const filtered = (data.schedules || []).filter((s: any) => s.agent_id === agentId);
        setSchedules(filtered);
      }
    } catch (err) {
      console.error('Failed to load agent workspace:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAgentAndTasks();

    // Supabase Realtime for live updates on this agent's tasks
    const supabase = supabaseService.getClient();
    const tasksChannel = supabase
      .channel(`ws-tasks-${agentId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'agent_tasks',
          filter: `agent_id=eq.${agentId}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setTasks((prev) => [payload.new as AgentTask, ...prev]);
          } else if (payload.eventType === 'UPDATE') {
            const updated = payload.new as AgentTask;
            setTasks((prev) =>
              prev.map((t) => (t.id === updated.id ? updated : t))
            );
            
            // If the updated task is currently running in the quick panel, update it
            if (updated.status === 'running') {
              setRunningOutput(updated.output || '');
            } else if (updated.status === 'done' || updated.status === 'failed') {
              setRunning(false);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(tasksChannel);
    };
  }, [agentId]);

  useEffect(() => {
    if (running) {
      outputEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [runningOutput, running]);

  const handleRunQuickTask = async () => {
    if (!quickTaskText.trim() || !agent) return;

    setRunning(true);
    setRunningOutput('');
    const text = quickTaskText;
    setQuickTaskText('');

    try {
      const response = await fetch('/api/startup-agents/task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId: agent.id,
          taskDescription: text,
          projectId,
          userId: '00000000-0000-0000-0000-000000000000',
          triggeredBy: 'user'
        }),
      });

      if (!response.body) return;
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let result = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        result += decoder.decode(value, { stream: true });
        setRunningOutput(result);
      }
    } catch (err: any) {
      setRunningOutput((prev) => prev + `\n\n[Execution Error]: ${err.message || String(err)}`);
    } finally {
      setRunning(false);
      loadAgentAndTasks();
    }
  };

  const handleUpdateSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agent) return;

    setSavingSettings(true);
    try {
      const res = await fetch('/api/startup-agents/update', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId,
          name: editName,
          model: editModel,
          isActive: editIsActive,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setAgent(data.agent);
        alert('Settings updated successfully.');
      }
    } catch (err) {
      console.error('Failed to update settings:', err);
    } finally {
      setSavingSettings(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#F5F3EE] font-dmsans">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-6 h-6 animate-spin text-[#D97757]" />
          <span className="text-xs text-[#5E5B56]">Loading workspace...</span>
        </div>
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#F5F3EE] font-dmsans">
        <span>Agent not found.</span>
      </div>
    );
  }

  const meta = roleMeta[agent.role];

  return (
    <div className="flex-1 flex h-full overflow-hidden bg-[#F5F3EE] font-dmsans select-none">
      {/* 3-Column workspace layout */}

      {/* LEFT COLUMN: Agent Card, Quick Run, Schedules */}
      <div className="w-[230px] border-r border-[#E5E0DA] bg-white flex flex-col justify-between shrink-0 p-4 overflow-y-auto">
        <div className="space-y-6">
          {/* Back Button */}
          <button
            type="button"
            onClick={() => router.push(`/startup/${projectId}`)}
            className="flex items-center gap-1.5 text-xs text-[#5E5B56] hover:text-[#191919] font-bold uppercase tracking-wider transition-colors cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Command Center</span>
          </button>

          {/* Compact Agent Identity */}
          <div className="bg-[#FBF9F6] border border-[#E5E0DA] rounded-2xl p-3 flex flex-col gap-2 relative">
            <div className="flex items-center gap-2.5">
              <div className={`w-9 h-9 rounded-xl ${meta?.avatarBg} flex items-center justify-center font-extrabold text-sm`}>
                {agent.role.slice(0, 1).toUpperCase()}
              </div>
              <div>
                <h3 className="text-xs font-extrabold text-[#191919]">{agent.name}</h3>
                <p className="text-[9px] text-[#5E5B56] font-bold uppercase tracking-wider">{agent.role.toUpperCase()}</p>
              </div>
            </div>
            <span className="text-[9px] bg-white border border-[#E5E0DA] px-2 py-0.5 rounded-full font-bold uppercase text-[#5E5B56] mt-1 text-center truncate">
              {agent.model.split('/').pop() || agent.model}
            </span>
          </div>

          {/* Quick Task Input */}
          <div className="space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#85827D] block">Quick Task</span>
            <div className="space-y-2">
              <textarea
                value={quickTaskText}
                onChange={(e) => setQuickTaskText(e.target.value)}
                placeholder={`Prompt ${agent.name}...`}
                rows={3}
                className="w-full bg-[#FBF9F6] border border-[#E5E0DA] rounded-xl p-2.5 text-xs text-[#191919] focus:outline-none focus:border-[#D97757] transition-all resize-none"
              />
              <button
                type="button"
                disabled={running || !quickTaskText.trim()}
                onClick={handleRunQuickTask}
                className="w-full flex items-center justify-center gap-1.5 bg-[#D97757] hover:bg-[#c66545] disabled:bg-[#ECE5DD] disabled:text-[#85827D] text-white rounded-xl py-2 text-xs font-bold transition-all cursor-pointer shadow-xs"
              >
                {running ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                <span>Execute</span>
              </button>
            </div>
          </div>

          {/* Schedules list */}
          <div className="space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#85827D] block">Schedules</span>
            {schedules.length === 0 ? (
              <p className="text-[10px] text-[#85827D] italic">No active schedules.</p>
            ) : (
              <div className="space-y-1.5">
                {schedules.map((s) => (
                  <div key={s.id} className="p-2 border border-[#E5E0DA] bg-[#FBF9F6] rounded-xl text-[10px] space-y-0.5">
                    <div className="font-bold text-[#191919] truncate">{s.task_template}</div>
                    <div className="text-[9px] text-[#85827D] font-mono">{s.cron_expression}</div>
                  </div>
                ))}
              </div>
            )}
            <button
              type="button"
              onClick={() => setActiveTab('settings')}
              className="text-[10px] text-[#D97757] hover:underline font-bold block"
            >
              Configure schedules in tabs ➔
            </button>
          </div>
        </div>
      </div>

      {/* MIDDLE COLUMN: Task History & Live Streaming Outputs */}
      <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#F5F3EE] p-6 lg:p-8 space-y-6">
        <div className="flex items-center justify-between border-b border-[#E5E0DA] pb-4">
          <h2 className="font-lora text-lg font-extrabold text-[#191919]">Execution Logs</h2>
          <span className="text-[10px] bg-white border border-[#E5E0DA] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider text-[#5E5B56]">
            {tasks.length} runs logged
          </span>
        </div>

        {/* Live Running Panel */}
        <AnimatePresence>
          {running && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="bg-white border border-[#D97757]/30 rounded-3xl p-5 shadow-md flex flex-col gap-3 max-h-[30vh] overflow-y-auto"
            >
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#D97757]">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Executing run stream...</span>
              </div>
              <div className="text-xs text-[#191919] leading-relaxed prose prose-sm max-w-none">
                {runningOutput ? (
                  <ReactMarkdown>{runningOutput}</ReactMarkdown>
                ) : (
                  <span className="italic text-[#85827D]">Initializing execution stream...</span>
                )}
                <div ref={outputEndRef} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Tasks list */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          {tasks.length === 0 ? (
            <div className="text-center py-12 border border-dashed border-[#E5E0DA] rounded-2xl bg-[#FBF9F6]">
              <Bot className="w-8 h-8 text-[#85827D] mx-auto mb-2 opacity-50" />
              <p className="text-xs text-[#5E5B56] font-medium">No tasks executed yet.</p>
            </div>
          ) : (
            tasks.map((task) => {
              const isExpanded = expandedTaskId === task.id;
              
              // Get tools list
              const tools = Array.isArray(task.tools_used) ? task.tools_used : [];

              return (
                <div
                  key={task.id}
                  className="bg-white border border-[#E5E0DA] rounded-3xl p-5 flex flex-col gap-3 shadow-[0_4px_16px_rgba(25,25,25,0.01)]"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h4 className="text-sm font-extrabold text-[#191919] leading-tight">
                        {task.title}
                      </h4>
                      <p className="text-[10px] text-[#85827D] mt-1 font-semibold uppercase tracking-wider">
                        {new Date(task.created_at).toLocaleString()} • via {task.triggered_by}
                      </p>
                    </div>

                    <div className="flex items-center gap-2.5">
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

                      <button
                        type="button"
                        onClick={() => setExpandedTaskId(isExpanded ? null : task.id)}
                        className="p-1 hover:bg-[#F4F0EB] text-[#5E5B56] rounded-lg transition-colors cursor-pointer shrink-0"
                      >
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="border-t border-[#E5E0DA] pt-4 mt-2 space-y-4 overflow-hidden"
                      >
                        {/* Description prompt */}
                        <div className="space-y-1">
                          <span className="text-[9px] font-bold uppercase tracking-wider text-[#85827D]">Assignment Description</span>
                          <p className="text-xs text-[#5E5B56] italic leading-relaxed font-medium">"{task.description}"</p>
                        </div>

                        {/* Tools list */}
                        {tools.length > 0 && (
                          <div className="space-y-2">
                            <span className="text-[9px] font-bold uppercase tracking-wider text-[#85827D]">Tools Used</span>
                            <div className="flex flex-wrap gap-1.5">
                              {tools.map((tName: string) => (
                                <span key={tName} className="text-[9px] bg-amber-50 border border-amber-200/50 text-amber-700 px-2 py-0.5 rounded-md font-mono font-bold">
                                  {tName}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Task output body */}
                        <div className="space-y-1">
                          <span className="text-[9px] font-bold uppercase tracking-wider text-[#85827D]">Task output</span>
                          <div className="prose prose-sm max-w-none text-[#191919] text-xs">
                            {task.output ? (
                              <ReactMarkdown>{task.output}</ReactMarkdown>
                            ) : (
                              <p className="italic text-[#85827D]">Output empty.</p>
                            )}
                          </div>
                        </div>

                        {task.status === 'done' && (
                          <TaskFeedback
                            taskId={task.id}
                            agentId={agentId}
                            projectId={projectId}
                            agentName={agent.name}
                            originalOutput={task.output}
                            onFeedbackSubmitted={loadAgentAndTasks}
                          />
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })
          )}
        </div>

        {/* Live Activity Feed */}
        <div className="border-t border-[#E5E0DA] pt-4 flex flex-col min-h-[250px] max-h-[350px] shrink-0">
          <h3 className="font-lora text-xs font-bold text-[#191919] mb-2 uppercase tracking-wider">
            Live Activity
          </h3>
          <div className="flex-1 overflow-hidden bg-white border border-[#E5E0DA] rounded-3xl p-4 min-h-0 shadow-2xs">
            <LiveFeed projectId={projectId} filterAgentId={agentId} compact={true} />
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN: Tab switcher (Memory | Messages | Judge | Analytics | Outreach | Settings) */}
      <div className="w-[300px] border-l border-[#E5E0DA] bg-white flex flex-col justify-between shrink-0 p-5 overflow-y-auto">
        <div className="space-y-6 h-full flex flex-col">
          {/* Tab buttons */}
          <div className="flex flex-wrap border-b border-[#E5E0DA] pb-2 gap-x-4 gap-y-2 text-xs font-bold uppercase tracking-wider text-[#85827D]">
            {[
              { id: 'memory', label: 'Memory' },
              { id: 'messages', label: 'Comms' },
              { id: 'browser', label: 'Browser' },
              { id: 'judge', label: 'Judge' },
              { id: 'analytics', label: 'Analytics' },
              { id: 'learning', label: 'Learning' },
              ...(agent.role === 'cso' ? [{ id: 'outreach', label: 'Outreach' }] : []),
              { id: 'settings', label: 'Settings' }
            ].map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`pb-1.5 transition-colors relative cursor-pointer ${
                    isActive ? 'text-[#D97757]' : 'hover:text-[#191919]'
                  }`}
                >
                  {tab.label}
                  {isActive && (
                    <motion.div layoutId="activeTabUnderline" className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#D97757]" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Tab panels */}
          <div className="flex-1 overflow-y-auto">
            {activeTab === 'memory' && (
              <MemoryPanel agentId={agentId} projectId={projectId} agentName={agent.name} />
            )}

            {activeTab === 'messages' && (
              <MessagesPanel agentId={agentId} projectId={projectId} />
            )}

            {activeTab === 'browser' && (
              <AgentBrowserSessionsPanel agentId={agentId} projectId={projectId} />
            )}

            {activeTab === 'judge' && (
              <JudgePanel agentId={agentId} projectId={projectId} />
            )}

            {activeTab === 'analytics' && (
              <AnalyticsPanel agentId={agentId} projectId={projectId} />
            )}

            {activeTab === 'learning' && (
              <LearningPanel agentId={agentId} projectId={projectId} agentName={agent.name} />
            )}

            {activeTab === 'outreach' && agent.role === 'cso' && (
              <OutreachTracker projectId={projectId} />
            )}

            {activeTab === 'settings' && (
              <div className="space-y-5">
                <form onSubmit={handleUpdateSettings} className="space-y-4">
                  <div>
                    <label htmlFor="agentName" className="block text-[10px] font-bold uppercase tracking-wider text-[#5E5B56] mb-1.5">
                      Agent Name
                    </label>
                    <input
                      type="text"
                      id="agentName"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full bg-[#FBF9F6] border border-[#E5E0DA] rounded-xl px-3 py-2 text-xs text-[#191919] focus:outline-none focus:border-[#D97757] transition-all font-semibold"
                    />
                  </div>

                  <div>
                    <label htmlFor="agentModel" className="block text-[10px] font-bold uppercase tracking-wider text-[#5E5B56] mb-1.5">
                      Target Model
                    </label>
                    <select
                      id="agentModel"
                      value={editModel}
                      onChange={(e) => setEditModel(e.target.value)}
                      className="w-full bg-[#FBF9F6] border border-[#E5E0DA] rounded-xl px-3 py-2 text-xs text-[#191919] focus:outline-none focus:border-[#D97757] transition-all cursor-pointer font-semibold"
                    >
                      {MODEL_OPTIONS.map((opt) => (
                        <option key={opt.id} value={opt.id}>
                          {opt.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center justify-between py-2 border-y border-[#E5E0DA]/80">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#5E5B56]">Active State</span>
                    <button
                      type="button"
                      onClick={() => setEditIsActive(!editIsActive)}
                      className="text-[#D97757] hover:opacity-80 transition-opacity cursor-pointer shrink-0"
                    >
                      {editIsActive ? <ToggleRight className="w-7 h-7" /> : <ToggleLeft className="w-7 h-7 text-[#85827D]" />}
                    </button>
                  </div>

                  <button
                    type="submit"
                    disabled={savingSettings}
                    className="w-full flex items-center justify-center gap-1.5 bg-[#D97757] hover:bg-[#c66545] disabled:bg-[#ECE5DD] disabled:text-[#85827D] text-white rounded-xl py-2 text-xs font-bold transition-all cursor-pointer"
                  >
                    {savingSettings ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                    <span>Save settings</span>
                  </button>
                </form>

                {/* Schedulers inside Settings Panel */}
                <div className="pt-4 border-t border-[#E5E0DA]">
                  <SchedulePanel agentId={agentId} projectId={projectId} />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
