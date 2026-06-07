'use client';

import React, { useState, useEffect } from 'react';
import { Target, Search, Mail, Send, CheckCircle2, ChevronDown, ChevronUp, Check, Loader2, RefreshCw, Eye, EyeOff } from 'lucide-react';

interface OutreachTrackerProps {
  projectId: string;
}

export default function OutreachTracker({ projectId }: OutreachTrackerProps) {
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedLeadId, setExpandedLeadId] = useState<string | null>(null);
  const [targetMarket, setTargetMarket] = useState('SaaS companies');
  const [runningPipeline, setRunningPipeline] = useState(false);
  const [pipelineLogs, setPipelineLogs] = useState('');

  const loadLeads = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/outreach/leads?projectId=${projectId}`);
      if (res.ok) {
        const data = await res.json();
        setLeads(data.leads || []);
      }
    } catch (err) {
      console.error('Failed to load outreach leads:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLeads();
  }, [projectId]);

  const handleRunPipeline = async () => {
    setRunningPipeline(true);
    setPipelineLogs('Starting CSO Lead Generation & Outreach Campaign...');
    try {
      const res = await fetch('/api/outreach/pipeline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          agentId: '00000000-0000-0000-0000-000000000000', // CSO service resolves this
          userId: '00000000-0000-0000-0000-000000000000',
          targetMarket,
          count: 3
        })
      });

      if (res.ok) {
        setPipelineLogs('Pipeline execution successfully finished.');
        loadLeads();
      } else {
        const err = await res.json();
        setPipelineLogs(`Pipeline failed: ${err.error}`);
      }
    } catch (err: any) {
      setPipelineLogs(`Error: ${err.message}`);
    } finally {
      setRunningPipeline(false);
    }
  };

  const handleApproveOutreach = async (leadId: string) => {
    try {
      const res = await fetch('/api/outreach/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId,
          userId: '00000000-0000-0000-0000-000000000000',
          projectId
        })
      });

      if (res.ok) {
        alert('Outreach email dispatched successfully.');
        loadLeads();
      } else {
        const err = await res.json();
        alert(`Failed to send: ${err.error}`);
      }
    } catch (err) {
      console.error('Failed to approve lead:', err);
    }
  };

  const handleMarkReplied = async (leadId: string) => {
    try {
      const supabase = (await import('../../services/supabase.service')).default.getServiceClient();
      const { error } = await supabase
        .from('outreach_leads')
        .update({
          reply_received: true,
          status: 'replied'
        })
        .eq('id', leadId);

      if (!error) {
        loadLeads();
      }
    } catch (err) {
      console.error('Failed to update reply status:', err);
    }
  };

  // Group stats
  const stats = {
    found: leads.filter((l) => l.status === 'found').length,
    researched: leads.filter((l) => l.status === 'researched').length,
    drafted: leads.filter((l) => l.status === 'drafted').length,
    sent: leads.filter((l) => l.status === 'sent').length,
    replied: leads.filter((l) => l.status === 'replied' || l.reply_received).length
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'found':
        return 'bg-blue-50 text-blue-700 border-blue-200/50';
      case 'researched':
        return 'bg-teal-50 text-teal-700 border-teal-200/50';
      case 'drafted':
        return 'bg-purple-50 text-purple-700 border-purple-200/50';
      case 'sent':
        return 'bg-green-50 text-green-700 border-green-200/50';
      case 'replied':
      case 'converted':
        return 'bg-rose-50 text-rose-700 border-rose-200/50';
      default:
        return 'bg-gray-50 text-gray-700 border-gray-200/50';
    }
  };

  return (
    <div className="space-y-6 font-dmsans h-full flex flex-col justify-between select-none">
      <div className="space-y-6 flex-1 overflow-y-auto pr-1">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#E5E0DA] pb-3">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#85827D]">
            <Target className="w-4 h-4 text-[#D97757]" />
            <span>CSO Outreach Pipeline</span>
          </div>

          <button
            type="button"
            onClick={loadLeads}
            className="p-1 hover:bg-[#F4F0EB] text-[#5E5B56] hover:text-[#191919] rounded-lg transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Trigger controls */}
        <div className="bg-[#FBF9F6] border border-[#E5E0DA] rounded-2xl p-4 space-y-3">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#85827D] block">Launch Outreach Campaign</span>
          
          <div className="flex gap-2">
            <input
              type="text"
              value={targetMarket}
              onChange={(e) => setTargetMarket(e.target.value)}
              placeholder="Enter target market..."
              className="flex-1 bg-white border border-[#E5E0DA] rounded-xl px-3 py-2 text-xs text-[#191919] focus:outline-none focus:border-[#D97757] transition-all font-semibold"
            />
            <button
              onClick={handleRunPipeline}
              disabled={runningPipeline || !targetMarket.trim()}
              className="bg-[#D97757] hover:bg-[#c66545] disabled:bg-[#ECE5DD] disabled:text-[#85827D] text-white rounded-xl px-4 py-2 text-xs font-bold transition-all cursor-pointer shadow-xs"
            >
              {runningPipeline ? 'Running...' : 'Run Outreach'}
            </button>
          </div>

          {runningPipeline && (
            <div className="bg-white border border-[#E5E0DA] rounded-xl p-3 text-[10px] font-mono text-[#5E5B56] whitespace-pre-wrap leading-relaxed max-h-[100px] overflow-y-auto">
              {pipelineLogs}
            </div>
          )}
        </div>

        {/* Pipeline kanban stages summary */}
        <div className="grid grid-cols-5 gap-2 text-center">
          {[
            { label: 'Found', count: stats.found, icon: Search, color: 'text-blue-600' },
            { label: 'Researched', count: stats.researched, icon: Target, color: 'text-teal-600' },
            { label: 'Drafted', count: stats.drafted, icon: Mail, color: 'text-purple-600' },
            { label: 'Sent', count: stats.sent, icon: Send, color: 'text-green-600' },
            { label: 'Replied', count: stats.replied, icon: CheckCircle2, color: 'text-rose-600' }
          ].map((stage) => {
            const Icon = stage.icon;
            return (
              <div key={stage.label} className="bg-[#FBF9F6] border border-[#E5E0DA] rounded-2xl p-2">
                <div className="flex justify-center mb-1">
                  <Icon className={`w-3.5 h-3.5 ${stage.color}`} />
                </div>
                <span className="text-[8px] font-bold text-[#85827D] uppercase tracking-wider block">{stage.label}</span>
                <span className="text-sm font-extrabold text-[#191919] mt-0.5 block">{stage.count}</span>
              </div>
            );
          })}
        </div>

        {/* Leads List */}
        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="w-5 h-5 animate-spin text-[#85827D]" />
          </div>
        ) : leads.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-[#E5E0DA] rounded-2xl bg-[#FBF9F6]">
            <Target className="w-8 h-8 text-[#85827D] mx-auto mb-2 opacity-50" />
            <p className="text-xs text-[#5E5B56] font-semibold">No prospects in database. Enter target market above to find leads.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {leads.map((lead) => {
              const isExpanded = expandedLeadId === lead.id;
              return (
                <div
                  key={lead.id}
                  className="bg-white border border-[#E5E0DA] rounded-2xl p-4 flex flex-col gap-3 shadow-[0_2px_8px_rgba(25,25,25,0.01)]"
                >
                  {/* Lead summary line */}
                  <div className="flex items-center justify-between gap-4">
                    <div className="truncate">
                      <h4 className="text-xs font-extrabold text-[#191919] leading-tight truncate">
                        {lead.company_name}
                      </h4>
                      <p className="text-[9px] text-[#85827D] font-mono truncate mt-0.5">
                        {lead.company_url || 'No URL'}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className={`text-[8px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${getStatusBadge(lead.status)}`}>
                        {lead.status}
                      </span>
                      
                      <button
                        onClick={() => setExpandedLeadId(isExpanded ? null : lead.id)}
                        className="p-1 hover:bg-[#F4F0EB] text-[#5E5B56] rounded-lg transition-colors cursor-pointer shrink-0"
                      >
                        {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  {/* Expandable details */}
                  {isExpanded && (
                    <div className="border-t border-[#F5F3EE] pt-3 mt-1 space-y-4 text-xs text-[#191919]">
                      {/* Contact information */}
                      <div className="grid grid-cols-2 gap-3 text-[10px] bg-[#FBF9F6] border border-[#E5E0DA] rounded-xl p-2.5">
                        <div>
                          <span className="text-[8px] font-bold uppercase tracking-wider text-[#85827D] block mb-0.5">Contact Name</span>
                          <span className="font-semibold">{lead.contact_name || 'Founder'}</span>
                        </div>
                        <div>
                          <span className="text-[8px] font-bold uppercase tracking-wider text-[#85827D] block mb-0.5">Contact Email</span>
                          <span className="font-semibold truncate">{lead.contact_email || 'N/A'}</span>
                        </div>
                      </div>

                      {/* Research notes */}
                      {lead.research_notes && (
                        <div className="space-y-1">
                          <span className="text-[8px] font-bold uppercase tracking-wider text-[#85827D]">Prospect Research Notes</span>
                          <p className="text-[11px] text-[#5E5B56] whitespace-pre-wrap leading-relaxed bg-[#FBF9F6] border border-[#E5E0DA] rounded-xl p-2.5">
                            {lead.research_notes}
                          </p>
                        </div>
                      )}

                      {/* Email draft preview */}
                      {lead.email_subject && (
                        <div className="space-y-2.5">
                          <span className="text-[8px] font-bold uppercase tracking-wider text-[#85827D] block">Cold Outreach Draft</span>
                          <div className="bg-[#FBF9F6] border border-[#E5E0DA] rounded-xl p-3 space-y-2">
                            <div>
                              <span className="text-[8px] font-mono text-[#85827D] uppercase tracking-wider block">Subject:</span>
                              <span className="font-extrabold text-[#191919]">{lead.email_subject}</span>
                            </div>
                            <div className="border-t border-[#E5E0DA] pt-2">
                              <span className="text-[8px] font-mono text-[#85827D] uppercase tracking-wider block mb-1">Body:</span>
                              <p className="font-medium text-[#5E5B56] leading-relaxed whitespace-pre-wrap">
                                {lead.email_body}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Action buttons */}
                      <div className="flex gap-2">
                        {lead.status === 'drafted' && (
                          <button
                            onClick={() => handleApproveOutreach(lead.id)}
                            className="flex-1 bg-green-600 hover:bg-green-700 text-white rounded-xl py-2 text-xs font-bold transition-all cursor-pointer text-center"
                          >
                            Approve & Send
                          </button>
                        )}
                        {lead.status === 'sent' && !lead.reply_received && (
                          <button
                            onClick={() => handleMarkReplied(lead.id)}
                            className="flex-1 bg-rose-600 hover:bg-rose-700 text-white rounded-xl py-2 text-xs font-bold transition-all cursor-pointer text-center"
                          >
                            Mark as Replied
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
