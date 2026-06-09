'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { StartupAgent, AgentTask, AgentMessage, Project } from '../../types';
import supabaseService from '../../services/supabase.service';
import AgentCard from './AgentCard';
import LiveFeed from '../stream/LiveFeed';
import TaskModal from './TaskModal';
import ApprovalCenter from './ApprovalCenter';
import WeeklyDigest from './WeeklyDigest';
import WebhookSettings from './WebhookSettings';
import { Play, Loader2, Bot, MessageSquare, AlertCircle, Settings, Users, Activity, FileText, CheckSquare, ShieldCheck, ToggleLeft, ToggleRight, Sparkles, RefreshCw } from 'lucide-react';

interface AgentOSDashboardProps {
  projectId: string;
}

export default function AgentOSDashboard({ projectId }: AgentOSDashboardProps) {
  const [activeTab, setActiveTab] = useState<'team' | 'activity' | 'approvals' | 'digests' | 'settings'>('team');
  const [agents, setAgents] = useState<any[]>([]);
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [project, setProject] = useState<Project | null>(null);
  
  // Weekly running state
  const [runningRun, setRunningRun] = useState(false);
  const [runStatus, setRunStatus] = useState('');

  // Activity filters state
  const [activityTasks, setActivityTasks] = useState<AgentTask[]>([]);
  const [filterAgent, setFilterAgent] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterScore, setFilterScore] = useState('');
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);

  // Settings state
  const [companyName, setCompanyName] = useState('');
  const [product, setProduct] = useState('');
  const [targetMarket, setTargetMarket] = useState('');
  const [stage, setStage] = useState<'idea' | 'mvp' | 'early-revenue' | 'growth'>('idea');
  const [problem, setProblem] = useState('');
  const [autoMode, setAutoMode] = useState(false);
  const [autoLevel, setAutoLevel] = useState<'supervised' | 'semi-auto' | 'full-auto'>('supervised');
  const [savingSettings, setSavingSettings] = useState(false);

  // Quick task modal state
  const [activeTaskAgent, setActiveTaskAgent] = useState<any | null>(null);
  const [messageNotification, setMessageNotification] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Agent name mapping helper
  const agentNamesMap = agents.reduce((acc, a) => {
    acc[a.id] = { name: a.name, role: a.role };
    return acc;
  }, {} as Record<string, { name: string; role: string }>);

  const loadDashboardData = async () => {
    try {
      const supabase = supabaseService.getClient();

      // 1. Fetch project details
      const { data: proj } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .single();
      
      if (proj) {
        setProject(proj);
        setAutoMode(proj.autonomous_mode ?? false);
        setAutoLevel(proj.autonomous_level ?? 'supervised');
      }

      // 2. Fetch startup agents
      const agentsRes = await fetch(`/api/startup-agents/list?projectId=${projectId}`);
      if (agentsRes.ok) {
        const data = await agentsRes.json();
        if (data && Array.isArray(data.agents)) {
          // Fetch memory counts for each agent to display
          const enriched = await Promise.all(data.agents.map(async (a: any) => {
            const { count } = await supabase
              .from('agent_memory')
              .select('*', { count: 'exact', head: true })
              .eq('agent_id', a.id);

            // Fetch average judge score
            const statsRes = await fetch(`/api/judge/stats?agentId=${a.id}&projectId=${projectId}`);
            let avgScore = 0;
            if (statsRes.ok) {
              const statsData = await statsRes.json();
              avgScore = statsData.stats?.average_score || 0;
            }

            return {
              ...a,
              memory_count: count || 0,
              avg_judge_score: avgScore
            };
          }));
          setAgents(enriched);
        }
      }

      // 3. Fetch latest inter-agent messages
      const { data: msgData } = await supabase
        .from('agent_messages')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })
        .limit(20);
      
      if (msgData) {
        setMessages(msgData);
      }

      // 4. Load context facts from memory to fill settings form
      const { data: memRows } = await supabase
        .from('agent_memory')
        .select('content')
        .eq('project_id', projectId)
        .ilike('content', 'Company Context:%');

      if (memRows && memRows.length > 0) {
        memRows.forEach((row) => {
          const content = row.content;
          if (content.includes('Company Name:')) setCompanyName(content.split('Company Name:').pop()?.trim() || '');
          if (content.includes('Product:')) setProduct(content.split('Product:').pop()?.trim() || '');
          if (content.includes('Target Market:')) setTargetMarket(content.split('Target Market:').pop()?.trim() || '');
          if (content.includes('Stage:')) setStage((content.split('Stage:').pop()?.trim() as any) || 'idea');
          if (content.includes('Core Problem:')) setProblem(content.split('Core Problem:').pop()?.trim() || '');
        });
      }

      // 5. Fetch all activity tasks
      const { data: actTasks } = await supabase
        .from('agent_tasks')
        .select('*, startup_agents(role, name)')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });
      
      if (actTasks) {
        setActivityTasks(actTasks);
      }

    } catch (err) {
      console.error('Failed to load Agent OS Dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();

    // Supabase Realtime for live updates
    const supabase = supabaseService.getClient();

    // Agents updates
    const agentsChannel = supabase
      .channel(`dashboard-agents-${projectId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'startup_agents', filter: `project_id=eq.${projectId}` }, (payload) => {
        setAgents((prev) => prev.map((a) => (a.id === payload.new.id ? { ...a, ...payload.new } : a)));
      })
      .subscribe();

    // Tasks updates
    const tasksChannel = supabase
      .channel(`dashboard-tasks-${projectId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'agent_tasks', filter: `project_id=eq.${projectId}` }, () => {
        // Reload all tasks when execution changes
        loadDashboardData();
      })
      .subscribe();

    // Messages updates
    const messagesChannel = supabase
      .channel(`dashboard-messages-${projectId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'agent_messages', filter: `project_id=eq.${projectId}` }, (payload) => {
        setMessages((prev) => [payload.new as AgentMessage, ...prev]);
        const msg = payload.new;
        
        // Push notification toast
        const sender = agents.find(a => a.id === msg.from_agent_id);
        const receiver = agents.find(a => a.id === msg.to_agent_id);
        if (sender && receiver) {
          setMessageNotification(`${sender.name} (${sender.role.toUpperCase()}) ➔ ${receiver.name} (${receiver.role.toUpperCase()}): "${msg.subject}"`);
          setTimeout(() => setMessageNotification(null), 5000);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(agentsChannel);
      supabase.removeChannel(tasksChannel);
      supabase.removeChannel(messagesChannel);
    };
  }, [projectId]);

  const handleRunWeeklyOrchestration = async () => {
    setRunningRun(true);
    setRunStatus('Starting weekly orchestration run...');
    try {
      const res = await fetch('/api/autonomous/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          userId: '00000000-0000-0000-0000-000000000000'
        })
      });

      if (res.ok) {
        setRunStatus('Weekly orchestration launched in background. Monitoring runs...');
        setTimeout(() => {
          setRunningRun(false);
          loadDashboardData();
        }, 3000);
      } else {
        const err = await res.json();
        setRunStatus(`Orchestration failed: ${err.error}`);
        setRunningRun(false);
      }
    } catch (err: any) {
      setRunStatus(`Error: ${err.message}`);
      setRunningRun(false);
    }
  };

  const handleUpdateSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      // 1. Save autonomous settings on project
      const patchRes = await fetch('/api/projects/autonomous', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          autonomousMode: autoMode,
          autonomousLevel: autoLevel
        })
      });

      // 2. Re-save startup context facts in memory for each agent
      const supabase = supabaseService.getServiceClient();
      for (const agent of agents) {
        // Clean old context
        await supabase
          .from('agent_memory')
          .delete()
          .eq('agent_id', agent.id)
          .eq('memory_type', 'fact')
          .ilike('content', 'Company Context:%');

        await fetch('/api/startup-agents/memory', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            agentId: agent.id,
            projectId,
            memoryType: 'fact',
            content: `Company Context: Company Name: ${companyName}`
          })
        });
        await fetch('/api/startup-agents/memory', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            agentId: agent.id,
            projectId,
            memoryType: 'fact',
            content: `Company Context: Product: ${product}`
          })
        });
        await fetch('/api/startup-agents/memory', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            agentId: agent.id,
            projectId,
            memoryType: 'fact',
            content: `Company Context: Target Market: ${targetMarket}`
          })
        });
        await fetch('/api/startup-agents/memory', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            agentId: agent.id,
            projectId,
            memoryType: 'fact',
            content: `Company Context: Stage: ${stage}`
          })
        });
        await fetch('/api/startup-agents/memory', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            agentId: agent.id,
            projectId,
            memoryType: 'fact',
            content: `Company Context: Core Problem: ${problem}`
          })
        });
      }

      if (patchRes.ok) {
        alert('Settings updated successfully.');
        loadDashboardData();
      }
    } catch (err) {
      console.error('Failed to save settings:', err);
    } finally {
      setSavingSettings(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex h-screen overflow-hidden bg-[#F5F3EE] items-center justify-center font-dmsans">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-6 h-6 animate-spin text-[#D97757]" />
          <span className="text-xs text-[#5E5B56]">Loading Agent OS Command Center...</span>
        </div>
      </div>
    );
  }

  // Filter tasks based on settings
  const filteredTasks = activityTasks.filter((task) => {
    if (filterAgent && task.agent_id !== filterAgent) return false;
    if (filterStatus && task.status !== filterStatus) return false;
    if (filterScore) {
      const score = task.judge_score || 0;
      if (filterScore === 'high' && score < 35) return false;
      if (filterScore === 'low' && score >= 35) return false;
      if (filterScore === 'untested' && task.judge_score !== null) return false;
    }
    return true;
  });

  return (
    <div className="flex-1 flex flex-col h-full bg-[#F5F3EE] font-dmsans overflow-y-auto p-6 lg:p-8 space-y-8 select-none">
      
      {/* Toast Notification Alert */}
      <AnimatePresence>
        {messageNotification && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-[#191919] text-white border border-[#E5E0DA]/20 px-4 py-3 rounded-full flex items-center gap-2.5 shadow-xl text-xs font-medium max-w-lg truncate"
          >
            <MessageSquare className="w-4 h-4 text-[#D97757] shrink-0" />
            <span className="truncate">{messageNotification}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top Navigation Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-[#E5E0DA] pb-5 gap-4">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#85827D]">Foundry Agent OS</span>
          <h1 className="font-lora text-2xl font-extrabold text-[#191919] mt-0.5">{companyName || project?.name}</h1>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Autonomous mode settings */}
          <div className="flex items-center gap-2 bg-white border border-[#E5E0DA] px-3.5 py-1.5 rounded-2xl">
            <span className="text-xs font-bold text-[#5E5B56]">Autonomous Mode</span>
            <button
              onClick={() => {
                setAutoMode(!autoMode);
                // Save immediately
                fetch('/api/projects/autonomous', {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ projectId, autonomousMode: !autoMode, autonomousLevel: autoLevel })
                });
              }}
              className="text-[#D97757] hover:opacity-85 transition-opacity cursor-pointer shrink-0"
            >
              {autoMode ? <ToggleRight className="w-7 h-7" /> : <ToggleLeft className="w-7 h-7 text-[#85827D]" />}
            </button>
          </div>

          <button
            onClick={handleRunWeeklyOrchestration}
            disabled={runningRun}
            className="flex items-center gap-1.5 bg-[#D97757] hover:bg-[#c66545] disabled:bg-[#ECE5DD] disabled:text-[#85827D] text-white rounded-2xl px-4 py-2 text-xs font-bold transition-all cursor-pointer shadow-xs"
          >
            {runningRun ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
            <span>Run This Week</span>
          </button>
        </div>
      </div>

      {/* Center Tab bar switcher */}
      <div className="flex border-b border-[#E5E0DA] pb-2 gap-6 text-xs font-bold uppercase tracking-wider text-[#85827D]">
        {[
          { id: 'team', label: 'Team Workspace', icon: Users },
          { id: 'activity', label: 'Task History', icon: Activity },
          { id: 'approvals', label: 'Approvals Center', icon: ShieldCheck },
          { id: 'digests', label: 'Weekly Digests', icon: FileText },
          { id: 'settings', label: 'OS Settings', icon: Settings }
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as any)}
              className={`pb-2 flex items-center gap-1.5 transition-colors relative cursor-pointer ${
                isActive ? 'text-[#D97757]' : 'hover:text-[#191919]'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
              {isActive && (
                <motion.div layoutId="dashboardTabUnderline" className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#D97757]" />
              )}
            </button>
          );
        })}
      </div>

      {/* Tab panel viewport */}
      <div className="flex-1 min-h-[450px]">
        {activeTab === 'team' && (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
            {/* Team grid section */}
            <div className="lg:col-span-3 space-y-6">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#85827D]">Startup Active Agents</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {agents.map((agent) => (
                  <div
                    key={agent.id}
                    className="bg-white border border-[#E5E0DA] rounded-3xl p-5 flex flex-col justify-between shadow-[0_2px_8px_rgba(25,25,25,0.01)] hover:border-[#D97757]/30 transition-all"
                  >
                    <div>
                      <div className="flex justify-between items-start">
                        <h4 className="text-xs font-extrabold text-[#191919]">{agent.name}</h4>
                        <span className="text-[8px] bg-[#FBF9F6] border border-[#E5E0DA] px-2 py-0.5 rounded-full font-bold uppercase text-[#5E5B56]">
                          {agent.role}
                        </span>
                      </div>
                      <p className="text-[10px] text-[#85827D] font-medium mt-1 uppercase tracking-wider">
                        {agent.is_active ? 'Status: ACTIVE' : 'Status: INACTIVE'}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-2 mt-4 text-[10px] bg-[#FBF9F6] border border-[#E5E0DA] rounded-2xl p-2.5 font-bold text-[#5E5B56]">
                      <div>
                        <span className="text-[8px] text-[#85827D] block">Memories</span>
                        <span>{agent.memory_count || 0} items</span>
                      </div>
                      <div>
                        <span className="text-[8px] text-[#85827D] block">Quality Avg</span>
                        <span>{agent.avg_judge_score ? `${agent.avg_judge_score}/50` : 'N/A'}</span>
                      </div>
                    </div>

                    <button
                      onClick={() => setActiveTaskAgent(agent)}
                      className="w-full bg-[#D97757] hover:bg-[#c66545] text-white rounded-xl py-2 mt-4 text-xs font-bold text-center transition-all cursor-pointer shadow-xs"
                    >
                      Assign Task
                    </button>
                  </div>
                ))}
              </div>

              {/* Task feed under cards */}
              <div className="pt-4 border-t border-[#E5E0DA]">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#85827D] mb-4">Latest Task Outcomes</h3>
                <LiveFeed projectId={projectId} />
              </div>
            </div>

            {/* Inter-agent messages Slack-style section */}
            <div className="lg:col-span-2 bg-white border border-[#E5E0DA] rounded-3xl p-5 flex flex-col justify-between overflow-hidden shadow-[0_4px_16px_rgba(25,25,25,0.01)] min-h-[500px]">
              <div className="space-y-4 flex-1 overflow-y-auto pr-1">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#85827D] border-b border-[#F5F3EE] pb-2 flex items-center gap-1.5">
                  <MessageSquare className="w-4 h-4 text-[#D97757]" />
                  <span>Slack-like Messages Feed</span>
                </h3>

                {messages.length === 0 ? (
                  <div className="text-center py-12 text-xs text-[#85827D] italic">No agent communication messages logged yet.</div>
                ) : (
                  <div className="space-y-3.5">
                    {messages.map((msg) => {
                      const from = agentNamesMap[msg.from_agent_id] || { name: 'System', role: 'ceo' };
                      const to = agentNamesMap[msg.to_agent_id] || { name: 'System', role: 'ceo' };

                      return (
                        <div
                          key={msg.id}
                          className="bg-[#FBF9F6] border border-[#E5E0DA] rounded-2xl p-3 space-y-2 text-xs relative overflow-hidden"
                        >
                          <div className="flex items-center justify-between text-[9px] font-bold text-[#85827D]">
                            <span className="uppercase tracking-wider">
                              {from.name} ({from.role.toUpperCase()}) ➔ {to.name} ({to.role.toUpperCase()})
                            </span>
                            <span>{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                          <div>
                            <span className="font-extrabold text-[#191919] block">{msg.subject}</span>
                            <p className="text-[#5E5B56] mt-0.5 leading-relaxed font-medium">
                              {msg.content}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'activity' && (
          <div className="space-y-6">
            {/* Filters */}
            <div className="bg-white border border-[#E5E0DA] rounded-3xl p-4 flex flex-wrap gap-4 items-center">
              <div>
                <label className="block text-[8px] font-bold uppercase tracking-wider text-[#85827D] mb-1">Agent</label>
                <select
                  value={filterAgent}
                  onChange={(e) => setFilterAgent(e.target.value)}
                  className="bg-[#FBF9F6] border border-[#E5E0DA] rounded-xl px-2 py-1.5 text-xs text-[#191919] focus:outline-none"
                >
                  <option value="">All Agents</option>
                  {agents.map((a) => (
                    <option key={a.id} value={a.id}>{a.name} ({a.role.toUpperCase()})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[8px] font-bold uppercase tracking-wider text-[#85827D] mb-1">Status</label>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="bg-[#FBF9F6] border border-[#E5E0DA] rounded-xl px-2 py-1.5 text-xs text-[#191919] focus:outline-none"
                >
                  <option value="">All Statuses</option>
                  <option value="done">Done</option>
                  <option value="running">Running</option>
                  <option value="failed">Failed</option>
                  <option value="queued">Queued</option>
                </select>
              </div>

              <div>
                <label className="block text-[8px] font-bold uppercase tracking-wider text-[#85827D] mb-1">Judge Grade</label>
                <select
                  value={filterScore}
                  onChange={(e) => setFilterScore(e.target.value)}
                  className="bg-[#FBF9F6] border border-[#E5E0DA] rounded-xl px-2 py-1.5 text-xs text-[#191919] focus:outline-none"
                >
                  <option value="">All Grades</option>
                  <option value="high">High Quality (35+)</option>
                  <option value="low">Needs Improvement (&lt;35)</option>
                  <option value="untested">Not Judged</option>
                </select>
              </div>
            </div>

            {/* List */}
            <div className="bg-white border border-[#E5E0DA] rounded-3xl overflow-hidden shadow-[0_2px_8px_rgba(25,25,25,0.01)]">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-[#FBF9F6] border-b border-[#E5E0DA] text-[9px] font-bold uppercase tracking-wider text-[#85827D]">
                    <th className="p-4">Agent</th>
                    <th className="p-4">Task Title</th>
                    <th className="p-4">Judge Score</th>
                    <th className="p-4">Status</th>
                    <th className="p-4">Execution Time</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTasks.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-[#85827D] italic">No tasks found matching filter criteria.</td>
                    </tr>
                  ) : (
                    filteredTasks.map((t: any) => {
                      const isExpanded = expandedTaskId === t.id;
                      const hasEvaluation = t.judge_score !== null;

                      return (
                        <React.Fragment key={t.id}>
                          <tr
                            onClick={() => setExpandedTaskId(isExpanded ? null : t.id)}
                            className="border-b border-[#F5F3EE] hover:bg-[#FBF9F6] cursor-pointer font-medium"
                          >
                            <td className="p-4 uppercase font-bold text-[#85827D]">
                              {t.startup_agents?.name || 'Agent'} ({t.startup_agents?.role || 'ceo'})
                            </td>
                            <td className="p-4 text-[#191919] font-extrabold">{t.title}</td>
                            <td className="p-4 font-bold">
                              {hasEvaluation ? `${t.judge_score}/50` : '—'}
                            </td>
                            <td className="p-4 uppercase font-bold text-[9px]">
                              {t.status}
                            </td>
                            <td className="p-4 text-[#85827D]">
                              {new Date(t.created_at).toLocaleString()}
                            </td>
                          </tr>

                          {/* Expandable row content */}
                          {isExpanded && (
                            <tr>
                              <td colSpan={5} className="p-4 bg-[#FBF9F6]/50 border-b border-[#E5E0DA]">
                                <div className="space-y-4 max-w-4xl">
                                  <div>
                                    <span className="text-[8px] font-bold uppercase text-[#85827D]">Description Prompt</span>
                                    <p className="text-xs italic text-[#5E5B56]">"{t.description}"</p>
                                  </div>
                                  <div>
                                    <span className="text-[8px] font-bold uppercase text-[#85827D]">Task Output log</span>
                                    <p className="text-xs whitespace-pre-wrap leading-relaxed bg-white border border-[#E5E0DA] rounded-xl p-3 max-h-[300px] overflow-y-auto font-medium">
                                      {t.output || 'No output recorded.'}
                                    </p>
                                  </div>
                                  {hasEvaluation && (
                                    <div className="bg-white border border-[#E5E0DA] rounded-xl p-3 space-y-2">
                                      <span className="text-[8px] font-bold uppercase text-[#85827D] block">Quality Judge Evaluation Detail</span>
                                      <div className="text-xs text-[#5E5B56] leading-relaxed">
                                        <p className="font-extrabold text-[#191919]">Feedback: {t.judge_feedback}</p>
                                        <p className="mt-1">Pass Status: {t.judge_passed ? 'PASSED (>= 35)' : 'REVISION REQUESTED (< 35)'}</p>
                                        <p>Revision Rounds: {t.revision_round || 0} rounds completed</p>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'approvals' && (
          <div className="max-w-xl mx-auto">
            <ApprovalCenter projectId={projectId} />
          </div>
        )}

        {activeTab === 'digests' && (
          <WeeklyDigest projectId={projectId} />
        )}

        {activeTab === 'settings' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Startup context details */}
            <form onSubmit={handleUpdateSettings} className="bg-white border border-[#E5E0DA] rounded-3xl p-6 space-y-4 shadow-[0_2px_8px_rgba(25,25,25,0.01)]">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#85827D] border-b border-[#F5F3EE] pb-2">
                Startup context profile
              </h3>

              <div>
                <label className="block text-[9px] font-bold uppercase tracking-wider text-[#5E5B56] mb-1">Company name</label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="w-full bg-[#FBF9F6] border border-[#E5E0DA] rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#D97757] font-semibold"
                />
              </div>

              <div>
                <label className="block text-[9px] font-bold uppercase tracking-wider text-[#5E5B56] mb-1">Product Description</label>
                <textarea
                  value={product}
                  onChange={(e) => setProduct(e.target.value)}
                  className="w-full bg-[#FBF9F6] border border-[#E5E0DA] rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#D97757] font-semibold resize-none"
                  rows={2}
                />
              </div>

              <div>
                <label className="block text-[9px] font-bold uppercase tracking-wider text-[#5E5B56] mb-1">Target Market</label>
                <input
                  type="text"
                  value={targetMarket}
                  onChange={(e) => setTargetMarket(e.target.value)}
                  className="w-full bg-[#FBF9F6] border border-[#E5E0DA] rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#D97757] font-semibold"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[9px] font-bold uppercase tracking-wider text-[#5E5B56] mb-1">Startup Stage</label>
                  <select
                    value={stage}
                    onChange={(e) => setStage(e.target.value as any)}
                    className="w-full bg-[#FBF9F6] border border-[#E5E0DA] rounded-xl px-3 py-2 text-xs focus:outline-none font-semibold cursor-pointer"
                  >
                    <option value="idea">Idea</option>
                    <option value="mvp">MVP</option>
                    <option value="early-revenue">Early Revenue</option>
                    <option value="growth">Growth</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[9px] font-bold uppercase tracking-wider text-[#5E5B56] mb-1">Core Problem Statement</label>
                <textarea
                  value={problem}
                  onChange={(e) => setProblem(e.target.value)}
                  className="w-full bg-[#FBF9F6] border border-[#E5E0DA] rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#D97757] font-semibold resize-none"
                  rows={2}
                />
              </div>

              <button
                type="submit"
                disabled={savingSettings}
                className="w-full bg-[#D97757] hover:bg-[#c66545] text-white rounded-xl py-2 text-xs font-bold transition-all cursor-pointer text-center"
              >
                {savingSettings ? 'Saving context...' : 'Save context changes'}
              </button>
            </form>

            {/* Autonomous modes configurations */}
            <div className="bg-white border border-[#E5E0DA] rounded-3xl p-6 space-y-4 shadow-[0_2px_8px_rgba(25,25,25,0.01)]">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#85827D] border-b border-[#F5F3EE] pb-2">
                Autonomous Loop settings
              </h3>

              <div className="flex items-center justify-between py-2 border-b border-[#F5F3EE]">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#5E5B56] block">Weekly Loop</span>
                  <span className="text-[9px] text-[#85827D]">Agents run continuously every week without manual input.</span>
                </div>
                <button
                  onClick={() => setAutoMode(!autoMode)}
                  className="text-[#D97757] hover:opacity-85 transition-opacity cursor-pointer shrink-0"
                >
                  {autoMode ? <ToggleRight className="w-7 h-7" /> : <ToggleLeft className="w-7 h-7 text-[#85827D]" />}
                </button>
              </div>

              <div>
                <label className="block text-[9px] font-bold uppercase tracking-wider text-[#5E5B56] mb-1.5">Safety Level</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'supervised', title: 'Supervised', desc: 'Approve actions' },
                    { id: 'semi-auto', title: 'Semi-Auto', desc: 'Send + notify' },
                    { id: 'full-auto', title: 'Full-Auto', desc: 'No approvals' }
                  ].map((level) => (
                    <button
                      key={level.id}
                      type="button"
                      onClick={() => setAutoLevel(level.id as any)}
                      className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                        autoLevel === level.id
                          ? 'bg-[#191919] border-transparent text-white'
                          : 'bg-[#FBF9F6] border-[#E5E0DA] text-[#5E5B56] hover:bg-[#F4F0EB]'
                      }`}
                    >
                      <span className="text-[10px] font-extrabold block">{level.title}</span>
                      <span className="text-[8px] opacity-80 block mt-0.5">{level.desc}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Webhook Configurations */}
            <WebhookSettings projectId={projectId} />
          </div>
        )}
      </div>

      {/* Task assignment modal */}
      <AnimatePresence>
        {activeTaskAgent && (
          <TaskModal
            agent={activeTaskAgent}
            projectId={projectId}
            onClose={() => {
              setActiveTaskAgent(null);
              loadDashboardData();
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
