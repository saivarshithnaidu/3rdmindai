'use client';

import React, { useState, useEffect } from 'react';
import { 
  ShieldAlert, 
  FileText, 
  Sparkles, 
  CheckCircle2, 
  AlertTriangle, 
  Info, 
  HelpCircle,
  Copy,
  Check,
  RefreshCw
} from 'lucide-react';

interface ContractAnalysisProps {
  contractId: string;
  projectId: string;
}

export default function ContractAnalysis({ contractId, projectId }: ContractAnalysisProps) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [generatingCounter, setGeneratingCounter] = useState(false);
  const [copied, setCopied] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/contracts/list?contractId=${contractId}`);
      const json = await res.json();
      if (json.success) {
        setData(json);
      }
    } catch (err) {
      console.error('Failed to fetch contract analysis details:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [contractId]);

  const handleGenerateCounter = async () => {
    setGeneratingCounter(true);
    try {
      const res = await fetch('/api/contracts/counter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contractId })
      });
      const json = await res.json();
      if (json.success) {
        // Reload details
        await fetchData();
      } else {
        alert(`Failed to compile proposal: ${json.error}`);
      }
    } catch (err) {
      console.error('Failed compiling proposal:', err);
    } finally {
      setGeneratingCounter(false);
    }
  };

  const handleCopyText = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatTrackedChanges = (text: string) => {
    if (!text) return null;
    
    // Parse the [ADDED: ...] and [REMOVED: ...] blocks
    const parts = text.split(/(\[ADDED:[\s\S]*?\]|\[REMOVED:[\s\S]*?\])/g);
    
    return (
      <div className="whitespace-pre-wrap font-mono text-xs text-body leading-relaxed bg-[#FFFFFF] border border-[#E5E0DA] rounded-xl p-5 max-h-[500px] overflow-y-auto">
        {parts.map((part, index) => {
          if (part.startsWith('[ADDED:')) {
            const inner = part.replace(/^\[ADDED:\s*/, '').replace(/\]$/, '');
            return (
              <ins key={index} className="bg-green-50 text-green-800 border-b border-green-200 px-1 font-semibold no-underline">
                {inner}
              </ins>
            );
          } else if (part.startsWith('[REMOVED:')) {
            const inner = part.replace(/^\[REMOVED:\s*/, '').replace(/\]$/, '');
            return (
              <del key={index} className="bg-red-50 text-red-700 line-through decoration-red-300 px-1 font-semibold">
                {inner}
              </del>
            );
          } else {
            return <span key={index}>{part}</span>;
          }
        })}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <RefreshCw className="w-6 h-6 text-[#cc785c] animate-spin" />
        <span className="text-xs text-muted-soft mt-2.5 font-dmsans">Loading Contract Intelligence report...</span>
      </div>
    );
  }

  if (!data || !data.contract) {
    return (
      <div className="text-center py-12 text-xs text-muted-soft font-dmsans italic">
        Contract records not found.
      </div>
    );
  }

  const { contract, analysis } = data;

  return (
    <div className="space-y-6 font-dmsans text-left pb-12">
      
      {/* Top Summary Block with overall safety score */}
      {analysis ? (
        <div className="bg-[#FFFFFF] border border-[#E5E0DA] rounded-2xl p-6 flex flex-col md:flex-row items-center gap-6 shadow-2xs">
          
          {/* Safety Gauge */}
          <div className="relative w-28 h-28 flex-shrink-0">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
              <circle
                className="stroke-hairline-soft"
                strokeWidth="7"
                fill="transparent"
                r="40"
                cx="50"
                cy="50"
              />
              <circle
                className={`transition-all duration-1000 ${
                  analysis.overall_score >= 80 ? 'stroke-[#5db872]' :
                  analysis.overall_score >= 50 ? 'stroke-[#e8a55a]' :
                  'stroke-[#c64545]'
                }`}
                strokeWidth="7"
                strokeDasharray={2 * Math.PI * 40}
                strokeDashoffset={2 * Math.PI * 40 * (1 - (analysis.overall_score || 0) / 100)}
                strokeLinecap="round"
                fill="transparent"
                r="40"
                cx="50"
                cy="50"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={`text-2xl font-serif font-normal ${
                analysis.overall_score >= 80 ? 'text-[#5db872]' :
                analysis.overall_score >= 50 ? 'text-[#e8a55a]' :
                'text-[#c64545]'
              }`}>
                {analysis.overall_score}
              </span>
              <span className="text-[8px] uppercase tracking-wider text-muted-soft font-bold">Safety Score</span>
            </div>
          </div>

          {/* Core Info */}
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-serif text-xl font-normal text-ink">Contract Review Thesis</h3>
              <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full ${
                analysis.risk_level === 'high' ? 'bg-red-50 text-[#c64545] border border-red-200/50' :
                analysis.risk_level === 'medium' ? 'bg-amber-50 text-[#e8a55a] border border-amber-200/50' :
                'bg-blue-50 text-[#5db8a6] border border-blue-200/50'
              }`}>
                {analysis.risk_level} Risk Level
              </span>
            </div>
            <p className="text-xs text-muted leading-relaxed">
              {analysis.plain_summary}
            </p>
          </div>
        </div>
      ) : (
        <div className="bg-[#FFFFFF] border border-[#E5E0DA] rounded-2xl p-6 text-center space-y-3">
          <AlertTriangle className="w-8 h-8 text-[#cc785c] mx-auto" />
          <div className="space-y-1">
            <h4 className="text-xs font-bold text-ink uppercase tracking-wide">Analysis Report Empty</h4>
            <p className="text-xs text-muted-soft max-w-sm mx-auto">
              This contract has not been processed yet. Click the "Trigger Analysis" button on the dashboard.
            </p>
          </div>
        </div>
      )}

      {/* Main Grid: Risks vs Missing Clauses */}
      {analysis && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Risky Clauses Column */}
          <div className="space-y-4">
            <h4 className="font-serif text-lg font-normal text-ink border-b border-hairline pb-2 flex items-center gap-2">
              <ShieldAlert className="w-4.5 h-4.5 text-[#cc785c]" />
              <span>Risky Clauses Found ({analysis.risky_clauses?.length || 0})</span>
            </h4>

            <div className="space-y-3">
              {analysis.risky_clauses?.map((rc: any, idx: number) => (
                <div key={idx} className="bg-white border border-[#E5E0DA] rounded-xl p-4 space-y-3 shadow-3xs">
                  <div className="flex justify-between items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-bold text-ink bg-surface-soft border border-hairline px-2.5 py-0.5 rounded-full">
                      Clause #{idx + 1}
                    </span>
                    <span className={`text-[9px] font-bold uppercase px-2 py-0.2 rounded-full ${
                      rc.severity === 'critical' ? 'bg-red-50 text-[#c64545]' :
                      rc.severity === 'major' ? 'bg-amber-50 text-[#e8a55a]' :
                      'bg-blue-50 text-[#5db8a6]'
                    }`}>
                      {rc.severity} Severity
                    </span>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[9px] font-bold text-muted uppercase tracking-wider block">Wording in Contract</span>
                    <p className="text-xs text-[#191919] italic bg-surface-soft/40 p-2 rounded border border-hairline/35 font-mono leading-relaxed">
                      "{rc.clause}"
                    </p>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[9px] font-bold text-[#c64545] uppercase tracking-wider block">Risk Review</span>
                    <p className="text-xs text-body leading-relaxed">
                      {rc.risk}
                    </p>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[9px] font-bold text-[#5db872] uppercase tracking-wider block">Founder Recommendation</span>
                    <p className="text-xs text-body font-semibold bg-green-50/20 border border-green-200/50 p-2.5 rounded-lg">
                      {rc.suggestion}
                    </p>
                  </div>
                </div>
              ))}

              {(!analysis.risky_clauses || analysis.risky_clauses.length === 0) && (
                <div className="text-center py-8 border border-dashed border-hairline rounded-xl text-xs text-muted-soft italic">
                  No risky clauses flags.
                </div>
              )}
            </div>
          </div>

          {/* Missing Clauses & Negotiation Points Column */}
          <div className="space-y-6">
            
            {/* Missing Clauses */}
            <div className="space-y-4">
              <h4 className="font-serif text-lg font-normal text-ink border-b border-hairline pb-2 flex items-center gap-2">
                <AlertTriangle className="w-4.5 h-4.5 text-[#e8a55a]" />
                <span>Missing Standard Clauses ({analysis.missing_clauses?.length || 0})</span>
              </h4>

              <div className="space-y-3">
                {analysis.missing_clauses?.map((mc: any, idx: number) => (
                  <div key={idx} className="bg-white border border-[#E5E0DA] rounded-xl p-4 space-y-2.5 shadow-3xs">
                    <div className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#e8a55a]" />
                      <span className="text-xs font-bold text-ink">{mc.clause_name}</span>
                    </div>
                    <p className="text-xs text-body leading-relaxed">{mc.why_needed}</p>
                    <div className="bg-surface-soft/40 p-2.5 rounded border border-hairline/50 font-mono text-[11px] leading-normal text-body">
                      {mc.suggested_text}
                    </div>
                  </div>
                ))}

                {(!analysis.missing_clauses || analysis.missing_clauses.length === 0) && (
                  <div className="text-center py-8 border border-dashed border-hairline rounded-xl text-xs text-muted-soft italic">
                    All standard clauses present.
                  </div>
                )}
              </div>
            </div>

            {/* Negotiation points */}
            <div className="space-y-4">
              <h4 className="font-serif text-lg font-normal text-ink border-b border-hairline pb-2 flex items-center gap-2">
                <Info className="w-4.5 h-4.5 text-[#5db8a6]" />
                <span>Strategic Negotiation Guidelines ({analysis.negotiation_pts?.length || 0})</span>
              </h4>

              <div className="space-y-3">
                {analysis.negotiation_pts?.map((np: any, idx: number) => (
                  <div key={idx} className="bg-white border border-[#E5E0DA] rounded-xl p-4 space-y-2 shadow-3xs">
                    <div className="text-xs font-bold text-ink flex justify-between items-center gap-2">
                      <span>{np.point}</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
                      <div className="bg-blue-50/15 border border-blue-200/40 p-2.5 rounded-lg text-xs">
                        <span className="font-bold text-[9px] uppercase tracking-wider text-[#5db8a6] block mb-0.5">Pushback Leverage</span>
                        <p className="text-muted leading-relaxed">{np.leverage}</p>
                      </div>
                      <div className="bg-surface-soft/45 border border-hairline p-2.5 rounded-lg text-xs">
                        <span className="font-bold text-[9px] uppercase tracking-wider text-ink block mb-0.5">Suggested Ask</span>
                        <p className="text-body font-semibold leading-relaxed">{np.suggested_ask}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Counter Proposal Rewrites Panel */}
      {analysis && (
        <div className="bg-white border border-[#E5E0DA] rounded-2xl p-6 space-y-4 shadow-2xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-hairline pb-4">
            <div>
              <h4 className="font-serif text-xl font-normal text-ink flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-[#cc785c]" />
                <span>AI Redline Counter-Proposal</span>
              </h4>
              <p className="text-xs text-muted mt-1 leading-normal">
                Compiles the contract text with marked insertions and removals aligning to your startup considerations.
              </p>
            </div>

            <div>
              {analysis.counter_proposal ? (
                <div className="flex gap-2">
                  <button
                    onClick={() => handleCopyText(analysis.counter_proposal)}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 border border-[#E5E0DA] hover:bg-surface-soft text-ink rounded-lg text-xs font-semibold cursor-pointer transition-all shadow-3xs"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-[#5db872]" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'Copied' : 'Copy Document'}</span>
                  </button>
                  <button
                    onClick={handleGenerateCounter}
                    disabled={generatingCounter}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#cc785c] hover:bg-[#a9583e] text-white rounded-lg text-xs font-semibold cursor-pointer transition-all shadow-3xs"
                  >
                    {generatingCounter ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                    <span>Re-draft</span>
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleGenerateCounter}
                  disabled={generatingCounter}
                  className="flex items-center gap-1.5 px-4 py-2 bg-[#cc785c] hover:bg-[#a9583e] text-white rounded-lg text-xs font-bold cursor-pointer transition-all shadow-sm"
                >
                  {generatingCounter ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Compiling Redlines...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>Generate Redline Counter-Proposal</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>

          <div>
            {analysis.counter_proposal ? (
              formatTrackedChanges(analysis.counter_proposal)
            ) : (
              <div className="text-center py-10 border border-dashed border-hairline rounded-xl text-xs text-muted-soft italic leading-relaxed max-w-sm mx-auto p-4">
                Click the button above to generate a consolidated redline draft of the agreement.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Prominent Legal Disclaimer */}
      <div className="bg-amber-50/25 border border-amber-200/50 rounded-2xl p-4 flex gap-3.5">
        <HelpCircle className="w-5 h-5 text-[#e8a55a] shrink-0 mt-0.5" />
        <div>
          <span className="font-bold text-ink uppercase tracking-wide text-[10px] block mb-1">Legal Notice & Disclaimer</span>
          <p className="text-muted-soft leading-relaxed text-xs">
            The risk analysis, suggestions, missing clauses checklists, and inline tracked redlines generated by this system are powered by Artificial Intelligence (LLM) and are provided for informational, diagnostic, and educational purposes only. They do NOT constitute formal legal advice, representation, or counsel. Utilizing this tool does not establish any attorney-client relationship. Startups should always consult a qualified legal professional under Indian jurisdiction before executing any legal agreements.
          </p>
        </div>
      </div>

    </div>
  );
}
