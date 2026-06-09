'use client';

import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  RefreshCw, 
  AlertCircle, 
  Calendar,
  DollarSign,
  Briefcase,
  Sparkles,
  Copy,
  Check,
  Download,
  CheckCircle2,
  Bookmark,
  ChevronRight,
  ExternalLink,
  ChevronDown
} from 'lucide-react';
import LiveFeed from '../stream/LiveFeed';
import { StreamEventType } from '../../types';

interface FundingOpportunity {
  id: string;
  name: string;
  provider: string;
  type: 'grant' | 'accelerator' | 'loan' | 'competition';
  amount_min: number;
  amount_max: number;
  currency: string;
  eligibility: string;
  deadline: string | null;
  application_url: string;
  description: string;
  stage_fit: string[];
  sector_fit: string[];
  source_url: string;
}

interface FundingMatch {
  id: string;
  project_id: string;
  opportunity_id: string;
  match_score: number;
  match_reasons: string[];
  application_draft: string | null;
  status: 'new' | 'interested' | 'applying' | 'applied' | 'rejected';
  alert_sent: boolean;
  created_at: string;
  funding_opportunities: FundingOpportunity;
}

interface FundingDashboardProps {
  projectId: string;
  userId: string;
}

export default function FundingDashboard({ projectId, userId }: FundingDashboardProps) {
  const [matches, setMatches] = useState<FundingMatch[]>([]);
  const [selectedMatch, setSelectedMatch] = useState<FundingMatch | null>(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'all' | 'grant' | 'accelerator' | 'applied'>('all');

  const fetchMatches = async (autoSelectId?: string) => {
    try {
      const res = await fetch(`/api/funding/list?projectId=${projectId}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.matches)) {
        setMatches(data.matches);
        
        if (data.matches.length > 0) {
          const toSelect = autoSelectId
            ? data.matches.find((m: FundingMatch) => m.id === autoSelectId) || data.matches[0]
            : selectedMatch
            ? data.matches.find((m: FundingMatch) => m.id === selectedMatch.id) || data.matches[0]
            : data.matches[0];
          setSelectedMatch(toSelect);
        } else {
          setSelectedMatch(null);
        }
      }
    } catch (err) {
      console.error('Failed to fetch funding matches:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMatches();
  }, [projectId]);

  const handleScan = async () => {
    setScanning(true);
    try {
      const res = await fetch('/api/funding/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId })
      });
      const data = await res.json();
      if (data.success) {
        // Poll for updates for the next 12 seconds
        let count = 0;
        const interval = setInterval(async () => {
          await fetchMatches();
          count++;
          if (count >= 4) {
            clearInterval(interval);
            setScanning(false);
          }
        }, 3000);
      } else {
        alert(`Failed to scan: ${data.error || 'Unknown error'}`);
        setScanning(false);
      }
    } catch (err) {
      console.error('Scan failed:', err);
      alert('Error scanning opportunities.');
      setScanning(false);
    }
  };

  const handleGenerateDraft = async () => {
    if (!selectedMatch) return;
    setDrafting(true);
    try {
      const res = await fetch('/api/funding/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchId: selectedMatch.id })
      });
      const data = await res.json();
      if (data.success && data.application_draft) {
        // Update local state
        const updatedMatch = {
          ...selectedMatch,
          application_draft: data.application_draft,
          status: 'applying' as const
        };
        setSelectedMatch(updatedMatch);
        setMatches(prev => prev.map(m => m.id === selectedMatch.id ? updatedMatch : m));
      } else {
        alert(`Draft failed: ${data.error}`);
      }
    } catch (err) {
      console.error('Draft error:', err);
    } finally {
      setDrafting(false);
    }
  };

  const handleStatusChange = async (newStatus: FundingMatch['status']) => {
    if (!selectedMatch) return;
    try {
      const res = await fetch('/api/funding/update-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchId: selectedMatch.id, status: newStatus })
      });
      const data = await res.json();
      if (data.success) {
        const updatedMatch = { ...selectedMatch, status: newStatus };
        setSelectedMatch(updatedMatch);
        setMatches(prev => prev.map(m => m.id === selectedMatch.id ? updatedMatch : m));
      }
    } catch (err) {
      console.error('Failed to update status:', err);
    }
  };

  const handleCopyDraft = () => {
    if (!selectedMatch?.application_draft) return;
    navigator.clipboard.writeText(selectedMatch.application_draft);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadDraft = () => {
    if (!selectedMatch?.application_draft) return;
    const blob = new Blob([selectedMatch.application_draft], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${selectedMatch.funding_opportunities.name.replace(/\s+/g, '_')}_application_draft.md`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const formatAmount = (min: number, max: number, currency: string) => {
    if (min === max) {
      return formatSingleAmount(min, currency);
    }
    return `${formatSingleAmount(min, currency)} - ${formatSingleAmount(max, currency)}`;
  };

  const formatSingleAmount = (amt: number, currency: string) => {
    if (currency === 'INR') {
      if (amt >= 10000000) {
        return `₹${(amt / 10000000).toFixed(1)} Crore`;
      }
      if (amt >= 100000) {
        return `₹${(amt / 100000).toFixed(1)} Lakh`;
      }
      return `₹${amt.toLocaleString()}`;
    }
    return `$${(amt / 1000).toFixed(0)}k USD`;
  };

  const getDeadlineDays = (deadlineStr: string | null) => {
    if (!deadlineStr) return null;
    const today = new Date();
    const deadline = new Date(deadlineStr);
    const diffTime = deadline.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const renderDeadlineBadge = (deadlineStr: string | null) => {
    const days = getDeadlineDays(deadlineStr);
    if (days === null) return null;

    if (days < 0) {
      return (
        <span className="text-[9px] font-bold text-red-700 bg-red-50 border border-red-200/50 px-2 py-0.5 rounded-full uppercase tracking-wider">
          Overdue
        </span>
      );
    }
    if (days <= 14) {
      return (
        <span className="text-[9px] font-bold text-red-700 bg-red-50 border border-red-200/50 px-2 py-0.5 rounded-full animate-pulse uppercase tracking-wider">
          closes in {days} days
        </span>
      );
    }
    return (
      <span className="text-[9px] font-bold text-[#8e8b82] bg-surface-soft border border-hairline px-2 py-0.5 rounded-full">
        {days} days left
      </span>
    );
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'applied': return 'bg-green-50 text-[#5db872] border border-green-200/30';
      case 'applying': return 'bg-blue-50 text-blue-600 border border-blue-200/30';
      case 'interested': return 'bg-amber-50 text-[#e8a55a] border border-amber-200/30';
      case 'rejected': return 'bg-red-50 text-[#c64545] border border-red-200/30';
      default: return 'bg-surface-soft text-muted border border-hairline';
    }
  };

  // Filter matches
  const filteredMatches = matches.filter(m => {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'grant') return m.funding_opportunities.type === 'grant';
    if (activeFilter === 'accelerator') return m.funding_opportunities.type === 'accelerator';
    if (activeFilter === 'applied') return m.status === 'applied' || m.status === 'applying';
    return true;
  });

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-screen bg-canvas font-dmsans">
        <RefreshCw className="w-6 h-6 text-[#cc785c] animate-spin" />
        <span className="text-xs text-muted-soft mt-2.5">Syncing Matching Opportunities...</span>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden font-dmsans">
      {/* Filters Header bar */}
      <div className="px-6 bg-[#FFFFFF] border-b border-hairline flex items-center justify-between shrink-0 select-none">
        <div className="flex gap-4 text-xs font-semibold">
          {([
            { id: 'all', label: 'All Opportunities' },
            { id: 'grant', label: 'Grants' },
            { id: 'accelerator', label: 'Accelerators' },
            { id: 'applied', label: 'Applying / Applied' }
          ] as const).map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveFilter(tab.id)}
              className={`py-3.5 border-b-2 cursor-pointer transition-all ${
                activeFilter === tab.id
                  ? 'border-[#cc785c] text-ink font-bold'
                  : 'border-transparent text-muted hover:text-ink'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <button
          onClick={handleScan}
          disabled={scanning}
          className="flex items-center gap-1 px-3 py-1.5 bg-[#cc785c] hover:bg-[#a9583e] text-white rounded-lg text-xs font-semibold cursor-pointer transition-colors shadow-2xs disabled:opacity-50"
        >
          {scanning ? (
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <RefreshCw className="w-3.5 h-3.5" />
          )}
          <span>{scanning ? 'Crawling Databases...' : 'Scan for Matches'}</span>
        </button>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
        
        {/* Left Side: Opportunities matches list */}
        <div className="w-full lg:w-96 border-b lg:border-b-0 lg:border-r border-hairline bg-surface-soft/45 flex flex-col shrink-0">
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            <div className="text-[10px] font-bold text-muted-soft px-2 py-1 uppercase tracking-wider text-left">
              Scored Opportunity Matches ({filteredMatches.length})
            </div>

            {filteredMatches.map((m) => {
              const opt = m.funding_opportunities;
              const isSelected = selectedMatch?.id === m.id;
              return (
                <button
                  key={m.id}
                  onClick={() => setSelectedMatch(m)}
                  className={`w-full flex flex-col p-4 rounded-xl border text-left cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-surface-cream-strong border-[#cc785c] text-ink shadow-3xs'
                      : 'bg-white border-[#E5E0DA] hover:border-[#cc785c]/45 text-muted'
                  }`}
                >
                  <div className="flex justify-between items-start gap-2 w-full">
                    <span className="text-xs font-bold text-ink leading-normal truncate max-w-[200px]">
                      {opt.name}
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                      m.match_score >= 80 ? 'bg-green-50 text-[#5db872]' : 'bg-amber-50 text-[#e8a55a]'
                    }`}>
                      {m.match_score}% Match
                    </span>
                  </div>

                  <div className="text-[10px] text-muted-soft mt-1 leading-normal truncate">
                    {opt.provider}
                  </div>

                  <div className="flex gap-2 flex-wrap mt-3.5 w-full">
                    <span className="text-[9px] font-semibold text-ink bg-surface-soft border border-hairline px-2 py-0.2 rounded">
                      {opt.type.toUpperCase()}
                    </span>
                    <span className="text-[9px] font-semibold text-ink bg-surface-soft border border-hairline px-2 py-0.2 rounded">
                      {formatAmount(opt.amount_min, opt.amount_max, opt.currency)}
                    </span>
                    {m.status !== 'new' && (
                      <span className={`text-[9px] font-bold uppercase px-2 py-0.2 rounded-full ${getStatusBadgeColor(m.status)}`}>
                        {m.status}
                      </span>
                    )}
                  </div>

                  {opt.deadline && (
                    <div className="flex items-center justify-between w-full mt-3 border-t border-hairline/45 pt-2.5">
                      <span className="text-[9px] text-muted-soft flex items-center gap-1 font-mono">
                        <Calendar className="w-3 h-3" />
                        Deadline: {opt.deadline}
                      </span>
                      {renderDeadlineBadge(opt.deadline)}
                    </div>
                  )}
                </button>
              );
            })}

            {filteredMatches.length === 0 && (
              <div className="text-center py-12 px-4 text-xs text-muted-soft italic leading-normal">
                No matching opportunities found. Click "Scan for Matches" above to trigger crawling agents.
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Details Drawer panel */}
        <div className="flex-1 flex flex-col h-full overflow-hidden">
          {selectedMatch ? (
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Header */}
              <div className="px-6 py-4 border-b border-hairline bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0 text-left select-none">
                <div>
                  <h3 className="font-serif text-lg font-normal text-ink">
                    {selectedMatch.funding_opportunities.name}
                  </h3>
                  <p className="text-[10px] text-muted-soft mt-0.5">
                    Provider: {selectedMatch.funding_opportunities.provider} • Scored Match {new Date(selectedMatch.created_at).toLocaleDateString()}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1 text-xs">
                    <span className="text-muted-soft font-semibold">Stage:</span>
                    <select
                      value={selectedMatch.status}
                      onChange={(e: any) => handleStatusChange(e.target.value)}
                      className="bg-white border border-[#E5E0DA] text-xs font-semibold text-ink rounded-lg px-2 py-1 focus:outline-none focus:border-[#cc785c] cursor-pointer"
                    >
                      <option value="new">New</option>
                      <option value="interested">Interested</option>
                      <option value="applying">Applying</option>
                      <option value="applied">Applied</option>
                      <option value="rejected">Rejected</option>
                    </select>
                  </div>

                  {selectedMatch.funding_opportunities.application_url && (
                    <a
                      href={selectedMatch.funding_opportunities.application_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 px-3 py-1.5 border border-[#E5E0DA] hover:bg-surface-soft text-ink rounded-lg text-xs font-semibold cursor-pointer transition-all shadow-3xs"
                    >
                      <span>Apply Portal</span>
                      <ExternalLink className="w-3.5 h-3.5 text-muted-soft" />
                    </a>
                  )}
                </div>
              </div>

              {/* Scrollable details */}
              <div className="flex-1 overflow-y-auto p-6 bg-canvas flex flex-col justify-between">
                <div className="flex-1 space-y-6 text-left">
                  
                  {/* Score & Reasons details */}
                  <div className="bg-[#FFFFFF] border border-[#E5E0DA] rounded-2xl p-5 space-y-3.5 shadow-3xs">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4.5 h-4.5 text-[#cc785c]" />
                      <h4 className="font-serif text-base font-normal text-ink">AI Alignment Reasoning</h4>
                    </div>

                    <div className="space-y-2.5 pl-1.5">
                      {selectedMatch.match_reasons?.map((reason, idx) => (
                        <div key={idx} className="flex gap-2 text-xs">
                          <CheckCircle2 className="w-4 h-4 text-[#5db872] shrink-0 mt-0.5" />
                          <span className="text-body leading-relaxed">{reason}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Program Description */}
                  <div className="space-y-2">
                    <h4 className="font-serif text-lg font-normal text-ink border-b border-hairline pb-1">Program Details</h4>
                    <p className="text-xs text-body leading-relaxed">{selectedMatch.funding_opportunities.description}</p>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-2">
                      <div className="bg-surface-soft/45 p-3 rounded-xl border border-hairline text-xs space-y-1">
                        <span className="font-bold text-[9px] uppercase tracking-wider text-muted-soft block">Eligibility Requirements</span>
                        <p className="text-body leading-relaxed">{selectedMatch.funding_opportunities.eligibility}</p>
                      </div>
                      
                      <div className="bg-surface-soft/45 p-3 rounded-xl border border-hairline text-xs space-y-2">
                        <span className="font-bold text-[9px] uppercase tracking-wider text-muted-soft block">Scope Dimensions</span>
                        <div className="space-y-1">
                          <div className="flex justify-between">
                            <span className="text-muted-soft">Amount Range:</span>
                            <span className="font-bold text-ink">{formatAmount(selectedMatch.funding_opportunities.amount_min, selectedMatch.funding_opportunities.amount_max, selectedMatch.funding_opportunities.currency)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-soft">Target Stage:</span>
                            <span className="font-semibold text-ink capitalize">{selectedMatch.funding_opportunities.stage_fit?.join(', ')}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-soft">Target Sectors:</span>
                            <span className="font-semibold text-ink capitalize">{selectedMatch.funding_opportunities.sector_fit?.join(', ')}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Application Answer Draft Panel */}
                  <div className="bg-white border border-[#E5E0DA] rounded-2xl p-6 space-y-4 shadow-2xs">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-hairline pb-4">
                      <div>
                        <h4 className="font-serif text-lg font-normal text-ink flex items-center gap-1.5">
                          <Sparkles className="w-4.5 h-4.5 text-[#cc785c]" />
                          <span>Generated Application Draft</span>
                        </h4>
                        <p className="text-[10px] text-muted-soft mt-0.5 leading-normal">
                          A customized proposal responding to the program criteria using your startup facts.
                        </p>
                      </div>

                      <div>
                        {selectedMatch.application_draft ? (
                          <div className="flex gap-1.5">
                            <button
                              onClick={handleCopyDraft}
                              className="flex items-center gap-1 px-2.5 py-1.5 border border-[#E5E0DA] hover:bg-surface-soft text-ink rounded-lg text-xs font-semibold cursor-pointer transition-all shadow-3xs"
                            >
                              {copied ? <Check className="w-3.5 h-3.5 text-[#5db872]" /> : <Copy className="w-3.5 h-3.5" />}
                              <span>{copied ? 'Copied' : 'Copy'}</span>
                            </button>
                            <button
                              onClick={handleDownloadDraft}
                              className="flex items-center gap-1 px-2.5 py-1.5 border border-[#E5E0DA] hover:bg-surface-soft text-ink rounded-lg text-xs font-semibold cursor-pointer transition-all shadow-3xs"
                            >
                              <Download className="w-3.5 h-3.5" />
                              <span>Download</span>
                            </button>
                            <button
                              onClick={handleGenerateDraft}
                              disabled={drafting}
                              className="flex items-center gap-1 px-2.5 py-1.5 bg-[#cc785c] hover:bg-[#a9583e] text-white rounded-lg text-xs font-semibold cursor-pointer transition-all shadow-3xs"
                            >
                              {drafting ? <RefreshCw className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                              <span>Regen</span>
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={handleGenerateDraft}
                            disabled={drafting}
                            className="flex items-center gap-1 px-4 py-2 bg-[#cc785c] hover:bg-[#a9583e] text-white rounded-lg text-xs font-bold cursor-pointer transition-all shadow-sm"
                          >
                            {drafting ? (
                              <>
                                <RefreshCw className="w-4 h-4 animate-spin" />
                                <span>Drafting answers...</span>
                              </>
                            ) : (
                              <>
                                <Sparkles className="w-4 h-4" />
                                <span>Generate Application Answers</span>
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    </div>

                    <div>
                      {selectedMatch.application_draft ? (
                        <div className="whitespace-pre-wrap font-mono text-[11px] text-body leading-relaxed bg-[#FFFFFF] border border-[#E5E0DA] rounded-xl p-5 max-h-[350px] overflow-y-auto">
                          {selectedMatch.application_draft}
                        </div>
                      ) : (
                        <div className="text-center py-8 border border-dashed border-hairline rounded-xl text-xs text-muted-soft italic leading-relaxed max-w-sm mx-auto p-4">
                          Generate draft answers matching executive summary, solutions, traction, and funding use rules automatically.
                        </div>
                      )}
                    </div>
                  </div>

                </div>

                {/* Stream Logs */}
                <div className="mt-8 border-t border-hairline pt-6 shrink-0 text-left">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-ink mb-3">Funding Match Agent Stream</h3>
                  <LiveFeed 
                    projectId={projectId} 
                    filterTypes={[
                      StreamEventType.EMAIL_DRAFTING,
                      StreamEventType.AGENT_COMPLETE,
                      StreamEventType.STREAM_ERROR
                    ]}
                    maxHeight="130px"
                    compact={true}
                  />
                </div>
              </div>
            </div>
          ) : (
            // Empty State
            <div className="flex flex-col items-center justify-center py-24 max-w-md mx-auto text-center space-y-5">
              <div className="w-16 h-16 rounded-full bg-[#cc785c]/10 flex items-center justify-center border border-[#cc785c]/20">
                <Briefcase className="w-8 h-8 text-[#cc785c]" />
              </div>

              <div className="space-y-2">
                <h2 className="font-serif text-2xl text-ink font-normal">Grants & Funding Finder</h2>
                <p className="text-sm text-body leading-relaxed">
                  Click the "Scan for Matches" button to let agents crawl Indian government grant databases, corporate accelerators (MSME, DPIIT, MeitY, YC), and venture programs. Compiles match compatibility scoring and drafts proposals.
                </p>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
