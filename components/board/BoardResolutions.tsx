'use client';

import React, { useState, useEffect } from 'react';
import { Check, X, FileSignature, ThumbsUp, ThumbsDown, Clock } from 'lucide-react';
import { motion } from 'framer-motion';

interface Resolution {
  id: string;
  project_id: string;
  title: string;
  resolution: string;
  proposed_by: string;
  approved_by: string[];
  status: 'proposed' | 'passed' | 'rejected';
  created_at: string;
}

interface BoardResolutionsProps {
  projectId: string;
  refreshKey: number;
}

export default function BoardResolutions({ projectId, refreshKey }: BoardResolutionsProps) {
  const [resolutions, setResolutions] = useState<Resolution[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchResolutions = async () => {
    try {
      const res = await fetch(`/api/board/resolutions?projectId=${projectId}`);
      const data = await res.json();
      if (data.success) {
        setResolutions(data.resolutions || []);
      }
    } catch (err) {
      console.error('Failed to load board resolutions:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchResolutions();
  }, [projectId, refreshKey]);

  const handleVote = async (resolutionId: string, status: 'passed' | 'rejected') => {
    try {
      const res = await fetch('/api/board/resolutions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resolutionId, status })
      });
      const data = await res.json();
      if (data.success) {
        // Optimistically update or refetch
        setResolutions((prev) =>
          prev.map((r) => (r.id === resolutionId ? { ...r, status } : r))
        );
      }
    } catch (err) {
      console.error('Failed to vote on resolution:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <span className="w-6 h-6 border-2 border-[#cc785c] border-t-transparent rounded-full animate-spin" />
        <span className="text-xs text-muted-soft mt-2">Loading board resolutions...</span>
      </div>
    );
  }

  return (
    <div className="bg-[#FFFFFF] border border-[#E5E0DA] rounded-2xl p-6 shadow-2xs text-left">
      <div className="flex items-center gap-2 border-b border-hairline pb-4 mb-6">
        <FileSignature className="w-5 h-5 text-[#cc785c]" />
        <div>
          <h2 className="font-serif text-xl font-normal text-ink">Board Resolutions Log</h2>
          <p className="text-xs text-muted mt-0.5 font-dmsans">Review and vote on major strategic resolutions drafted by the Board of Directors.</p>
        </div>
      </div>

      <div className="space-y-4">
        {resolutions.map((res) => {
          const statusColors = {
            proposed: 'bg-amber-50 text-amber-700 border-amber-200/50',
            passed: 'bg-green-50 text-green-700 border-green-200/50',
            rejected: 'bg-red-50 text-red-700 border-red-200/50'
          };

          return (
            <motion.div
              layout
              key={res.id}
              className={`p-5 rounded-xl border transition-all ${
                res.status === 'proposed'
                  ? 'bg-canvas border-[#E5E0DA] hover:border-[#cc785c]'
                  : 'bg-surface-soft/20 border-hairline'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div>
                  <h3 className="font-serif text-md font-normal text-ink leading-snug">
                    {res.title}
                  </h3>
                  <div className="flex items-center gap-2 text-[10px] text-muted-soft mt-1">
                    <span>Proposed by: {res.proposed_by}</span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(res.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border shrink-0 text-center ${statusColors[res.status]}`}>
                  {res.status}
                </span>
              </div>

              <p className="text-xs text-body leading-relaxed mt-3 pt-3 border-t border-dashed border-hairline/80 font-dmsans">
                {res.resolution}
              </p>

              {res.status === 'proposed' && (
                <div className="flex items-center justify-end gap-3 mt-4 pt-3 border-t border-hairline/50">
                  <button
                    onClick={() => handleVote(res.id, 'rejected')}
                    className="flex items-center gap-1.5 px-3 py-1.5 border border-[#E5E0DA] hover:border-red-200 text-muted hover:text-red-600 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
                  >
                    <ThumbsDown className="w-3.5 h-3.5" />
                    <span>Reject</span>
                  </button>
                  <button
                    onClick={() => handleVote(res.id, 'passed')}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#cc785c] hover:bg-[#a9583e] text-white rounded-lg text-xs font-bold cursor-pointer transition-all shadow-3xs"
                  >
                    <ThumbsUp className="w-3.5 h-3.5 fill-white" />
                    <span>Approve</span>
                  </button>
                </div>
              )}
            </motion.div>
          );
        })}

        {resolutions.length === 0 && (
          <div className="text-center py-10 border border-dashed border-hairline rounded-xl text-xs text-muted-soft italic bg-surface-soft/15 font-dmsans">
            No board resolutions recorded. Convene a board meeting to propose one.
          </div>
        )}
      </div>
    </div>
  );
}
