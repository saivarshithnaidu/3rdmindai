'use client';

import React, { useState } from 'react';
import { CodeReview, CodeIssue } from '../../types/coding';

interface ReviewPanelProps {
  review: CodeReview | null;
  onApplyFix: (issue: CodeIssue) => Promise<void>;
  onJumpToLine?: (line: number) => void;
  isApplyingFix?: boolean;
  onRunReview?: () => void;
  isRunningReview?: boolean;
}

export default function ReviewPanel({
  review,
  onApplyFix,
  onJumpToLine,
  isApplyingFix = false,
  onRunReview,
  isRunningReview = false
}: ReviewPanelProps) {
  const [fixingId, setFixingId] = useState<number | null>(null);

  const handleApplyFix = async (issue: CodeIssue, index: number) => {
    setFixingId(index);
    try {
      await onApplyFix(issue);
    } finally {
      setFixingId(null);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600 border-green-500';
    if (score >= 50) return 'text-amber-500 border-amber-400';
    return 'text-red-500 border-red-500';
  };

  const getSeverityBadge = (severity: 'critical' | 'major' | 'minor') => {
    switch (severity) {
      case 'critical':
        return <span className="bg-red-100 text-red-700 border border-red-200 text-[10px] font-bold px-1.5 py-0.5 rounded-full uppercase">Critical</span>;
      case 'major':
        return <span className="bg-amber-100 text-amber-700 border border-amber-200 text-[10px] font-bold px-1.5 py-0.5 rounded-full uppercase">Major</span>;
      case 'minor':
        return <span className="bg-blue-100 text-blue-700 border border-blue-200 text-[10px] font-bold px-1.5 py-0.5 rounded-full uppercase">Minor</span>;
    }
  };

  if (isRunningReview) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center select-none font-dmsans">
        <i className="ti ti-loader text-3xl animate-spin text-[#cc785c]" />
        <p className="text-xs text-[#5E5B56] mt-3 font-medium">Running deep AI code review...</p>
        <p className="text-[10px] text-[#85827D] mt-1 max-w-[200px]">Evaluating security, performance, and best practices.</p>
      </div>
    );
  }

  if (!review) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center select-none font-dmsans">
        <i className="ti ti-shield-half text-4xl mb-2 text-[#cc785c]" />
        <h4 className="text-xs font-semibold text-[#191919]">No Code Review Generated</h4>
        <p className="text-[10px] text-[#85827D] mt-1 max-w-[200px] mb-4">
          Generate an AI report to audit the selected file.
        </p>
        {onRunReview && (
          <button
            onClick={onRunReview}
            className="flex items-center gap-1.5 bg-[#cc785c] hover:bg-[#a9583e] text-white text-xs px-4 py-2 rounded-full font-medium transition-colors cursor-pointer shadow-2xs"
          >
            <i className="ti ti-shield-check text-xs" />
            <span>Review current file</span>
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6 overflow-y-auto max-h-[500px] pr-1 font-dmsans">
      {/* Score ring */}
      <div className="flex items-center gap-4 bg-white border border-[#E5E0DA] rounded-xl p-4 shadow-3xs">
        <div className={`w-14 h-14 rounded-full border-4 flex items-center justify-center font-lora text-lg font-bold shrink-0 ${getScoreColor(review.overall_score)}`}>
          {review.overall_score}
        </div>
        <div>
          <h4 className="text-xs font-bold text-[#191919]">Overall Code Quality</h4>
          <p className="text-[11px] text-[#5E5B56] mt-0.5 leading-relaxed">{review.summary}</p>
        </div>
      </div>

      {/* Security flags (Red) */}
      {review.security_flags && review.security_flags.length > 0 && (
        <div className="border border-red-200 bg-red-50/50 rounded-xl overflow-hidden shadow-4xs">
          <div className="bg-red-50 border-b border-red-100 px-3.5 py-2.5 flex items-center gap-2 text-red-800">
            <i className="ti ti-alert-triangle text-sm" />
            <h4 className="text-xs font-bold">Security Alerts ({review.security_flags.length})</h4>
          </div>
          <div className="divide-y divide-red-100 px-3.5">
            {review.security_flags.map((flag, i) => (
              <div key={i} className="py-3 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-red-950">{flag.type}</span>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full uppercase border ${
                    flag.severity === 'high' 
                      ? 'bg-red-100 text-red-700 border-red-200' 
                      : flag.severity === 'medium'
                      ? 'bg-amber-100 text-amber-700 border-amber-200'
                      : 'bg-blue-100 text-blue-700 border-blue-200'
                  }`}>{flag.severity}</span>
                </div>
                <p className="text-[11px] text-red-800/80 leading-relaxed">{flag.description}</p>
                {flag.fix && (
                  <p className="text-[10px] text-red-700 font-medium bg-red-100/30 p-2 rounded">
                    <span className="font-bold">Fix: </span>{flag.fix}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Issues list */}
      <div className="space-y-3">
        <h4 className="text-xs font-bold text-[#85827D] uppercase tracking-wider">Issues & Fixes ({(review.issues || []).length})</h4>
        {(review.issues || []).length === 0 ? (
          <div className="text-center py-6 text-xs text-[#85827D] italic border border-dashed border-[#E5E0DA] rounded-xl bg-white">
            No logical bugs or issues detected!
          </div>
        ) : (
          <div className="space-y-3">
            {review.issues.map((issue, idx) => (
              <div key={idx} className="bg-white border border-[#E5E0DA] rounded-xl overflow-hidden shadow-3xs">
                <div className="bg-[#F9F8F6] px-3.5 py-2.5 border-b border-[#E5E0DA] flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {getSeverityBadge(issue.severity)}
                    {issue.line && (
                      <button
                        onClick={() => onJumpToLine && onJumpToLine(issue.line!)}
                        className="text-[11px] text-[#cc785c] hover:underline font-semibold cursor-pointer"
                      >
                        Line {issue.line}
                      </button>
                    )}
                  </div>
                  <button
                    onClick={() => handleApplyFix(issue, idx)}
                    disabled={isApplyingFix || fixingId !== null}
                    className="flex items-center gap-1 bg-[#cc785c] hover:bg-[#a9583e] text-white text-[10px] font-bold px-2 py-1 rounded transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    {fixingId === idx ? (
                      <>
                        <i className="ti ti-loader animate-spin" />
                        <span>Fixing...</span>
                      </>
                    ) : (
                      <>
                        <i className="ti ti-wand" />
                        <span>Apply Fix</span>
                      </>
                    )}
                  </button>
                </div>
                <div className="p-3.5 space-y-2">
                  <p className="text-xs text-[#191919] leading-relaxed font-medium">{issue.issue}</p>
                  <div className="bg-[#1e1e1e] p-2.5 rounded-lg border border-[#2d2d2d] overflow-x-auto">
                    <pre className="text-[10px] text-[#c5c5c5] font-mono leading-relaxed whitespace-pre">
                      {issue.code_fix}
                    </pre>
                  </div>
                  <p className="text-[10px] text-[#5E5B56] leading-relaxed"><span className="font-bold">Rationale:</span> {issue.fix}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Suggestions (Amber) */}
      {review.suggestions && review.suggestions.length > 0 && (
        <div className="border border-amber-200 bg-amber-50/30 rounded-xl overflow-hidden shadow-4xs">
          <div className="bg-amber-50/70 border-b border-amber-100 px-3.5 py-2.5 flex items-center gap-2 text-amber-800">
            <i className="ti ti-bulb text-sm" />
            <h4 className="text-xs font-bold">Suggestions ({review.suggestions.length})</h4>
          </div>
          <div className="divide-y divide-amber-100 px-3.5">
            {review.suggestions.map((suggestion, i) => (
              <div key={i} className="py-3 space-y-1">
                <div className="text-xs font-semibold text-amber-950">{suggestion.type}</div>
                <p className="text-[11px] text-amber-800/80 leading-relaxed">{suggestion.description}</p>
                {suggestion.example && (
                  <pre className="bg-[#1e1e1e] text-[#c5c5c5] font-mono text-[9px] p-2 rounded border border-[#2d2d2d] overflow-x-auto mt-1.5 whitespace-pre">
                    {suggestion.example}
                  </pre>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
