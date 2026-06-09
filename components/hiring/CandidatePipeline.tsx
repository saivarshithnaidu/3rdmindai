'use client';

import React from 'react';
import { ArrowLeft, ArrowRight, Star, Globe, ShieldAlert } from 'lucide-react';
import { motion } from 'framer-motion';

interface Candidate {
  id: string;
  name: string;
  email: string | null;
  linkedin_url: string | null;
  source: 'linkedin' | 'naukri' | 'manual' | 'referral';
  match_score: number | null;
  status: 'new' | 'screening' | 'interview' | 'assessment' | 'offer' | 'rejected' | 'hired';
  created_at: string;
}

interface CandidatePipelineProps {
  candidates: Candidate[];
  onSelectCandidate: (candidateId: string) => void;
  onUpdateStatus: (candidateId: string, nextStatus: string) => void;
}

export default function CandidatePipeline({
  candidates,
  onSelectCandidate,
  onUpdateStatus,
}: CandidatePipelineProps) {
  // Define recruitment pipeline stages
  const columns: Array<{ id: string; label: string; bg: string; text: string }> = [
    { id: 'new', label: 'Sourced', bg: 'bg-[#FAF6F0] border-hairline', text: 'text-muted-soft' },
    { id: 'screening', label: 'Screening', bg: 'bg-blue-50/10 border-blue-100', text: 'text-blue-700' },
    { id: 'interview', label: 'Interviews', bg: 'bg-amber-50/10 border-amber-100', text: 'text-amber-700' },
    { id: 'assessment', label: 'Evaluations', bg: 'bg-purple-50/10 border-purple-100', text: 'text-purple-700' },
    { id: 'offer', label: 'Offer', bg: 'bg-green-50/15 border-green-100', text: 'text-green-700' },
    { id: 'rejected', label: 'Rejected', bg: 'bg-red-50/10 border-red-100', text: 'text-red-600' },
  ];

  const getCandidateForCol = (colId: string) => {
    return candidates.filter((c) => {
      if (colId === 'offer') {
        return c.status === 'offer' || c.status === 'hired';
      }
      return c.status === colId;
    });
  };

  const getNextCol = (currentStatus: string): string | null => {
    const sequence = ['new', 'screening', 'interview', 'assessment', 'offer'];
    const idx = sequence.indexOf(currentStatus);
    if (idx !== -1 && idx < sequence.length - 1) {
      return sequence[idx + 1];
    }
    return null;
  };

  const getPrevCol = (currentStatus: string): string | null => {
    const sequence = ['new', 'screening', 'interview', 'assessment', 'offer'];
    const idx = sequence.indexOf(currentStatus);
    if (idx > 0) {
      return sequence[idx - 1];
    }
    return null;
  };

  return (
    <div className="flex-1 flex gap-4 overflow-x-auto pb-4 select-none font-dmsans text-left min-h-[450px]">
      {columns.map((col) => {
        const list = getCandidateForCol(col.id);
        return (
          <div
            key={col.id}
            className={`w-72 shrink-0 rounded-2xl border p-4 flex flex-col ${col.bg}`}
          >
            {/* Column Header */}
            <div className="flex items-center justify-between mb-4 border-b border-hairline pb-2 shrink-0">
              <span className={`text-xs font-bold uppercase tracking-wider ${col.text}`}>{col.label}</span>
              <span className="text-[10px] font-bold bg-white text-muted px-2 py-0.5 rounded-full border border-hairline">
                {list.length}
              </span>
            </div>

            {/* Candidate Card Items list */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {list.map((c) => {
                const next = getNextCol(c.status);
                const prev = getPrevCol(c.status);

                return (
                  <motion.div
                    layout
                    key={c.id}
                    className="bg-[#FFFFFF] border border-[#E5E0DA] hover:border-[#cc785c] rounded-xl p-4 shadow-3xs hover:shadow-2xs transition-all relative group"
                  >
                    {/* Candidate Details Row */}
                    <div 
                      onClick={() => onSelectCandidate(c.id)}
                      className="cursor-pointer space-y-2"
                    >
                      <div className="flex justify-between items-start gap-2">
                        <h4 className="font-serif text-sm font-normal text-ink leading-tight group-hover:text-[#cc785c] transition-colors truncate max-w-[150px]">
                          {c.name}
                        </h4>
                        
                        {c.match_score !== null && (
                          <span className={`text-[9px] font-mono font-bold bg-surface-soft px-1.5 py-0.5 rounded border flex items-center gap-0.5 ${
                            c.match_score >= 80 ? 'text-green-600 border-green-200' : 'text-amber-600 border-amber-200'
                          }`}>
                            <Star className="w-2.5 h-2.5 fill-current" />
                            {c.match_score}%
                          </span>
                        )}
                      </div>

                      <div className="flex items-center justify-between text-[9px] text-muted-soft">
                        <span className="capitalize bg-surface-soft px-1.5 py-0.2 rounded font-semibold">{c.source}</span>
                        <span>{new Date(c.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>

                    {/* Column Shift Arrows */}
                    <div className="flex justify-between items-center mt-3 pt-2 border-t border-hairline/50">
                      {prev ? (
                        <button
                          onClick={() => onUpdateStatus(c.id, prev)}
                          className="p-1 hover:bg-surface-soft rounded text-muted hover:text-ink cursor-pointer transition-colors"
                          title="Move Left"
                        >
                          <ArrowLeft className="w-3 h-3" />
                        </button>
                      ) : (
                        <div className="w-5" />
                      )}

                      {next ? (
                        <button
                          onClick={() => onUpdateStatus(c.id, next)}
                          className="p-1 hover:bg-surface-soft rounded text-muted hover:text-ink cursor-pointer transition-colors"
                          title="Move Right"
                        >
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      ) : (
                        <div className="w-5" />
                      )}
                    </div>
                  </motion.div>
                );
              })}

              {list.length === 0 && (
                <div className="text-center py-12 text-[10px] text-muted-soft italic">
                  Drag/Drop applicant here
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
