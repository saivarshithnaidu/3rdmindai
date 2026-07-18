'use client';

import React, { useEffect, useState } from 'react';
import supabaseService from '../../services/supabase.service';

interface CodeTeamViewProps {
  projectId: string;
  sessionId: string;
  onClose?: () => void;
}

export default function CodeTeamView({
  projectId,
  sessionId,
  onClose
}: CodeTeamViewProps) {
  const [team, setTeam] = useState<any>(null);
  const [agents, setAgents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const supabase = supabaseService.getServiceClient();
      
      // Fetch code team details
      const { data: teamData } = await supabase
        .from('code_teams')
        .select('*')
        .eq('session_id', sessionId)
        .maybeSingle();

      if (teamData) {
        setTeam(teamData);
        
        // Fetch active agents
        const { data: agentData } = await supabase
          .from('code_team_agents')
          .select('*')
          .eq('team_id', teamData.id);

        if (agentData) {
          setAgents(agentData);
        }
      }
    } catch (err) {
      console.error('Failed to load team data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    
    // Subscribe to realtime database changes
    const supabase = supabaseService.getClient();
    const channel = supabase
      .channel(`code-team-realtime-${sessionId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'code_team_agents' },
        () => {
          fetchData();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'code_teams', filter: `session_id=eq.${sessionId}` },
        () => {
          fetchData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId]);

  const getAgentCard = (role: string) => {
    const agent = agents.find(a => a.role === role);
    if (!agent) return null;

    const assignedCount = agent.assigned_files?.length || 0;
    const completedCount = agent.completed_files?.length || 0;
    const progress = assignedCount > 0 ? Math.round((completedCount / assignedCount) * 100) : 0;
    
    const status = agent.status;
    const isRunning = status === 'running';
    const isDone = status === 'done';

    return (
      <div className={`border rounded-xl p-4 transition-all space-y-3 shadow-4xs select-none relative bg-white ${
        isRunning 
          ? 'border-[#cc785c] ring-1 ring-[#cc785c]/30 animate-pulse' 
          : isDone 
          ? 'border-green-200 bg-green-50/20' 
          : 'border-[#E5E0DA]'
      }`}>
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <h4 className="text-xs font-bold text-[#191919] capitalize flex items-center gap-1.5">
              <i className={`ti ${
                role === 'architect' ? 'ti-compass' :
                role === 'frontend' ? 'ti-layout' :
                role === 'backend' ? 'ti-server' :
                role === 'database' ? 'ti-database' :
                role === 'testing' ? 'ti-shield-check' : 'ti-tool'
              } text-[#cc785c]`} />
              {role}
            </h4>
            <span className="text-[8px] bg-[#F4F0EB] text-[#5E5B56] border border-[#E5E0DA] font-bold px-1.5 py-0.5 rounded font-mono">
              {agent.model.split('/').pop()}
            </span>
          </div>

          <span className={`text-[8px] font-bold px-2 py-0.5 rounded-full uppercase border ${
            isRunning 
              ? 'bg-amber-50 text-amber-700 border-amber-200' 
              : isDone 
              ? 'bg-green-50 text-green-700 border-green-200' 
              : 'bg-zinc-50 text-zinc-400 border-zinc-200'
          }`}>
            {status}
          </span>
        </div>

        {assignedCount > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[9px] font-semibold text-[#5E5B56]">
              <span>Completed: {completedCount}/{assignedCount} files</span>
              <span>{progress}%</span>
            </div>
            <div className="w-full h-1 bg-[#F4F0EB] rounded-full overflow-hidden">
              <div className="h-full bg-[#cc785c] rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="bg-[#F9F8F6] border border-[#E5E0DA] rounded-2xl p-6 shadow-3xs max-w-xl mx-auto space-y-6 font-dmsans">
      <div className="flex items-center justify-between border-b border-[#F4F0EB] pb-4">
        <div>
          <h3 className="font-lora text-base font-bold text-[#191919] flex items-center gap-2">
            <i className="ti ti-users text-[#cc785c]" />
            Multi-Agent Code Team
          </h3>
          <p className="text-[10px] text-[#85827D] mt-0.5 font-medium">Visualizing collaborative pipeline construction in real time</p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-[#85827D] hover:text-[#191919] p-1.5 hover:bg-[#F4F0EB] rounded-lg cursor-pointer"
          >
            <i className="ti ti-x text-xs" />
          </button>
        )}
      </div>

      {loading ? (
        <div className="text-center py-10 text-xs text-[#85827D]">
          <i className="ti ti-loader animate-spin mr-2" />
          Loading active team participants...
        </div>
      ) : !team ? (
        <div className="text-center py-10 text-xs text-[#85827D] italic">
          No active multi-agent team found for this session.
        </div>
      ) : (
        <div className="relative flex flex-col space-y-6">
          
          {/* Vertical Pipeline connector line */}
          <div className="absolute top-8 bottom-8 left-[calc(50%-1px)] w-[2px] bg-[#E5E0DA] z-0 select-none" />

          {/* Phase 1: Architect */}
          <div className="relative z-10 max-w-xs mx-auto w-full">
            {getAgentCard('architect')}
          </div>

          {/* Phase 2: Parallel Grid */}
          <div className="relative z-10 grid grid-cols-3 gap-3">
            {getAgentCard('frontend')}
            {getAgentCard('backend')}
            {getAgentCard('database')}
          </div>

          {/* Phase 3: Testing */}
          <div className="relative z-10 max-w-xs mx-auto w-full">
            {getAgentCard('testing')}
          </div>

          {/* Phase 4: DevOps */}
          <div className="relative z-10 max-w-xs mx-auto w-full">
            {getAgentCard('devops')}
          </div>

          {/* Realtime logs ticker */}
          <div className="border border-[#E5E0DA] bg-white rounded-xl p-4 space-y-2.5 shadow-4xs select-none">
            <span className="text-[10px] font-bold text-[#85827D] uppercase tracking-wider block">Realtime Pipeline Logs</span>
            <div className="font-mono text-[9px] text-[#5E5B56] space-y-1.5 leading-relaxed bg-[#F9F8F6] p-3 rounded-lg border border-[#F4F0EB] max-h-[100px] overflow-y-auto">
              <div className="text-[#191919] font-bold flex items-center gap-1.5">
                <span className="w-1 h-1 rounded-full bg-[#cc785c] animate-pulse" />
                <span>Current Status: {team.status.toUpperCase()}</span>
              </div>
              <div className="text-zinc-500">Pipeline initialized successfully. Spawning containers...</div>
              {agents.some(a => a.status === 'running') && (
                <div className="text-[#cc785c] animate-pulse font-semibold">
                  Active builders writing codebase components...
                </div>
              )}
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
