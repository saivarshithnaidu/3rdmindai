'use client';

import React, { useState, useEffect } from 'react';
import { Mail, MessageSquare, Check, X, AlertCircle, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';

interface ApprovalCenterProps {
  projectId: string;
}

export default function ApprovalCenter({ projectId }: ApprovalCenterProps) {
  const [approvals, setApprovals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState<Record<string, string>>({});
  const [showRejectFormId, setShowRejectFormId] = useState<string | null>(null);

  const loadApprovals = async () => {
    setLoading(true);
    try {
      const supabase = (await import('../../services/supabase.service')).default.getClient();
      const { data, error } = await supabase
        .from('pending_approvals')
        .select('*, startup_agents(name, role)')
        .eq('project_id', projectId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (!error && data) {
        setApprovals(data);
      }
    } catch (err) {
      console.error('Failed to load pending approvals:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadApprovals();
  }, [projectId]);

  const handleDecision = async (approvalId: string, decision: 'approve' | 'reject') => {
    try {
      const reason = decision === 'reject' ? rejectionReason[approvalId] : undefined;

      const res = await fetch('/api/autonomous/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          approvalId,
          userId: '00000000-0000-0000-0000-000000000000',
          decision,
          reason
        })
      });

      if (res.ok) {
        // Remove from list with animation or filter immediately
        setApprovals((prev) => prev.filter((a) => a.id !== approvalId));
        setShowRejectFormId(null);
      } else {
        const err = await res.json();
        alert(`Error executing decision: ${err.error}`);
      }
    } catch (err) {
      console.error('Approval decision failed:', err);
    }
  };

  return (
    <div className="space-y-4 font-dmsans">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#E5E0DA] pb-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-[#85827D] flex items-center gap-1.5">
          <AlertCircle className="w-4 h-4 text-[#D97757]" />
          <span>Action Approvals Center</span>
        </h3>
        <button
          onClick={loadApprovals}
          className="p-1 hover:bg-[#F4F0EB] text-[#5E5B56] hover:text-[#191919] rounded-lg transition-colors cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {loading ? (
        <div className="text-center py-6 text-xs text-[#85827D]">Loading pending actions...</div>
      ) : approvals.length === 0 ? (
        <div className="text-center py-10 border border-dashed border-[#E5E0DA] rounded-2xl bg-[#FBF9F6]">
          <Check className="w-6 h-6 text-green-600 mx-auto mb-2" />
          <p className="text-xs text-[#5E5B56] font-semibold">All actions approved. No pending items.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {approvals.map((app) => {
            const isEmail = app.action_type === 'send_email';
            const data = app.action_data || {};
            const isExpanded = expandedId === app.id;

            return (
              <div
                key={app.id}
                className="bg-white border border-[#E5E0DA] rounded-2xl p-4 flex flex-col gap-3 shadow-[0_2px_8px_rgba(25,25,25,0.01)]"
              >
                {/* Agent request header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-orange-50 border border-orange-200/50 text-orange-600 flex items-center justify-center font-bold text-xs uppercase">
                      {app.startup_agents?.role?.slice(0, 1) || 'A'}
                    </div>
                    <div>
                      <h4 className="text-xs font-extrabold text-[#191919]">
                        {app.startup_agents?.name || 'Agent'}
                      </h4>
                      <p className="text-[9px] text-[#85827D] font-bold uppercase tracking-wider">
                        {app.startup_agents?.role || 'assistant'}
                      </p>
                    </div>
                  </div>

                  <span className={`text-[8px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                    isEmail ? 'bg-blue-50 text-blue-700 border-blue-200/50' : 'bg-purple-50 text-purple-700 border-purple-200/50'
                  } flex items-center gap-1`}>
                    {isEmail ? <Mail className="w-2.5 h-2.5" /> : <MessageSquare className="w-2.5 h-2.5" />}
                    <span>{isEmail ? 'Send Email' : 'Post Content'}</span>
                  </span>
                </div>

                {/* Details summary */}
                <div className="text-xs text-[#191919] space-y-2">
                  {isEmail ? (
                    <>
                      <div>
                        <span className="text-[8px] font-bold text-[#85827D] uppercase tracking-wider block">Recipient</span>
                        <span className="font-semibold">{data.to || data.contact_email || 'N/A'}</span>
                      </div>
                      <div>
                        <span className="text-[8px] font-bold text-[#85827D] uppercase tracking-wider block">Subject</span>
                        <span className="font-extrabold">{data.subject || data.email_subject || 'No Subject'}</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <span className="text-[8px] font-bold text-[#85827D] uppercase tracking-wider block">Platform</span>
                        <span className="font-semibold">{data.platform || data.channel || 'Slack'}</span>
                      </div>
                    </>
                  )}

                  {/* Expand button */}
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : app.id)}
                    className="flex items-center gap-1 text-[9px] font-bold text-[#D97757] hover:underline cursor-pointer"
                  >
                    {isExpanded ? (
                      <>
                        <ChevronUp className="w-3 h-3" />
                        <span>Hide Preview</span>
                      </>
                    ) : (
                      <>
                        <ChevronDown className="w-3 h-3" />
                        <span>Show Message Preview</span>
                      </>
                    )}
                  </button>

                  {/* Expandable message body */}
                  {isExpanded && (
                    <div className="bg-[#FBF9F6] border border-[#E5E0DA] rounded-xl p-3 text-[11px] text-[#5E5B56] leading-relaxed whitespace-pre-wrap font-medium max-h-[150px] overflow-y-auto">
                      {data.body || data.email_body || data.content || JSON.stringify(data, null, 2)}
                    </div>
                  )}
                </div>

                {/* Action buttons */}
                {showRejectFormId === app.id ? (
                  <div className="space-y-2 pt-2 border-t border-[#F5F3EE]">
                    <textarea
                      value={rejectionReason[app.id] || ''}
                      onChange={(e) => setRejectionReason({ ...rejectionReason, [app.id]: e.target.value })}
                      placeholder="Provide a reason for rejection (this updates the agent's memory)..."
                      className="w-full bg-[#FBF9F6] border border-[#E5E0DA] rounded-xl p-2 text-xs text-[#191919] focus:outline-none focus:border-[#D97757] transition-all resize-none"
                      rows={2}
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleDecision(app.id, 'reject')}
                        disabled={!rejectionReason[app.id]?.trim()}
                        className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-[#ECE5DD] text-white rounded-xl py-2 text-xs font-bold transition-all cursor-pointer"
                      >
                        Confirm Rejection
                      </button>
                      <button
                        onClick={() => setShowRejectFormId(null)}
                        className="bg-white border border-[#E5E0DA] hover:bg-[#F4F0EB] text-[#5E5B56] rounded-xl px-4 py-2 text-xs font-bold transition-all cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-2 pt-2 border-t border-[#F5F3EE]">
                    <button
                      onClick={() => handleDecision(app.id, 'approve')}
                      className="flex-1 flex items-center justify-center gap-1.5 bg-green-600 hover:bg-green-700 text-white rounded-xl py-2 text-xs font-bold transition-all cursor-pointer shadow-xs"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Approve</span>
                    </button>
                    <button
                      onClick={() => setShowRejectFormId(app.id)}
                      className="flex-1 flex items-center justify-center gap-1.5 bg-red-50 border border-red-200/50 hover:bg-red-100 text-red-600 rounded-xl py-2 text-xs font-bold transition-all cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                      <span>Reject</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
