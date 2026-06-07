import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { BrowserSession } from '../../types';
import supabaseService from '../../services/supabase.service';
import { SCRAPER_CONFIGS } from '../../lib/scrapers.registry';
import { Globe, Clock, Table2, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';

interface AgentBrowserSessionsPanelProps {
  agentId: string;
  projectId: string;
}

export default function AgentBrowserSessionsPanel({ agentId, projectId }: AgentBrowserSessionsPanelProps) {
  const router = useRouter();
  const [sessions, setSessions] = useState<BrowserSession[]>([]);
  const [loading, setLoading] = useState(true);

  const loadSessions = async () => {
    try {
      const supabase = supabaseService.getClient();
      const { data, error } = await supabase
        .from('browser_sessions')
        .select('*')
        .eq('agent_id', agentId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSessions(data || []);
    } catch (err) {
      console.error('Failed to load browser sessions for agent:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSessions();

    const supabase = supabaseService.getClient();
    const channel = supabase
      .channel(`agent-browser-sessions-${agentId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'browser_sessions',
          filter: `agent_id=eq.${agentId}`,
        },
        () => {
          loadSessions();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [agentId]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-[#5E5B56]">
        <Loader2 className="w-4 h-4 animate-spin text-[#D97757] mb-1.5" />
        <span className="text-[10px]">Loading browser history...</span>
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="text-center py-8 border border-dashed border-[#E5E0DA] rounded-xl bg-[#FBF9F6] p-4">
        <Globe className="w-6 h-6 text-[#85827D] mx-auto mb-1.5 opacity-50" />
        <p className="text-[10px] text-[#5E5B56] font-bold">No browser sessions logged.</p>
        <p className="text-[9px] text-[#85827D] mt-0.5 leading-normal">
          When this agent triggers browser automation, execution details will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3 font-dmsans">
      {sessions.map((session) => {
        const config = SCRAPER_CONFIGS.find((c) => c.id === session.scraper_type);
        const scraperName = config?.name || session.scraper_type;

        let statusBadge = (
          <span className="inline-flex items-center gap-1 text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100">
            <Loader2 className="w-2 h-2 animate-spin" />
            <span>Active</span>
          </span>
        );

        if (session.status === 'completed') {
          statusBadge = (
            <span className="inline-flex items-center gap-1 text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
              <CheckCircle2 className="w-2.5 h-2.5" />
              <span>Done</span>
            </span>
          );
        } else if (session.status === 'error') {
          statusBadge = (
            <span className="inline-flex items-center gap-1 text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-100">
              <AlertTriangle className="w-2.5 h-2.5" />
              <span>Failed</span>
            </span>
          );
        }

        const dateStr = new Date(session.created_at).toLocaleDateString([], {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });

        return (
          <div
            key={session.id}
            className="p-3 bg-white border border-[#E5E0DA] rounded-xl space-y-2.5 shadow-2xs hover:shadow-xs transition-shadow"
          >
            {/* Header info */}
            <div className="flex items-center justify-between gap-2">
              <span className="px-1.5 py-0.5 bg-[#191919] text-white rounded-md text-[8px] font-bold uppercase tracking-wider shrink-0">
                {scraperName}
              </span>
              <div className="flex items-center gap-1.5">
                {statusBadge}
              </div>
            </div>

            {/* Query */}
            <p className="text-xs font-semibold text-[#191919] leading-relaxed break-words">
              "{session.query}"
            </p>

            {/* Stats & Link */}
            <div className="flex items-center justify-between pt-1 border-t border-[#E5E0DA]/55 text-[10px] font-semibold text-[#85827D]">
              <div className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-[#85827D]" />
                <span>{dateStr}</span>
              </div>

              <span>{session.rows_extracted} rows</span>

              {session.canvas_id && (
                <button
                  onClick={() => router.push(`/project/${projectId}?tab=canvas&canvasId=${session.canvas_id}`)}
                  className="flex items-center gap-1 text-blue-600 hover:text-blue-700 hover:underline cursor-pointer"
                >
                  <Table2 className="w-3.5 h-3.5" />
                  <span>View Canvas</span>
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
