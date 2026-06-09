'use client';

import React, { useState, useEffect } from 'react';
import { 
  Globe, 
  Plus, 
  RefreshCw, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  ExternalLink,
  ChevronDown,
  ChevronRight,
  Shield,
  Clock,
  HelpCircle
} from 'lucide-react';
import LiveFeed from '../stream/LiveFeed';
import { StreamEventType } from '../../types';

interface HealthScan {
  id: string;
  project_id: string;
  user_id: string;
  target_url: string;
  status: 'running' | 'complete' | 'failed';
  score: number | null;
  checks_passed: number;
  checks_failed: number;
  created_at: string;
}

interface HealthFinding {
  id: string;
  scan_id: string;
  category: 'performance' | 'seo' | 'accessibility' | 'configuration' | 'security';
  priority: 'high' | 'medium' | 'low' | 'info';
  title: string;
  description: string;
  recommendation: string;
  docs_url: string | null;
  created_at: string;
}

interface HealthDashboardProps {
  projectId: string;
  userId: string;
}

export default function HealthDashboard({ projectId, userId }: HealthDashboardProps) {
  const [scans, setScans] = useState<HealthScan[]>([]);
  const [selectedScan, setSelectedScan] = useState<HealthScan | null>(null);
  const [findings, setFindings] = useState<HealthFinding[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingScan, setLoadingScan] = useState(false);
  const [targetUrl, setTargetUrl] = useState('');
  const [scanning, setScanning] = useState(false);
  const [expandedFindings, setExpandedFindings] = useState<Record<string, boolean>>({});

  const fetchScansList = async (autoSelectScanId?: string) => {
    try {
      const res = await fetch(`/api/health/list?projectId=${projectId}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.scans)) {
        setScans(data.scans);
        if (data.scans.length > 0) {
          const toSelect = autoSelectScanId 
            ? data.scans.find((s: HealthScan) => s.id === autoSelectScanId) || data.scans[0]
            : data.scans[0];
          setSelectedScan(toSelect);
        } else {
          setSelectedScan(null);
          setFindings([]);
        }
      }
    } catch (err) {
      console.error('Failed to fetch health scans list:', err);
    } finally {
      setLoadingList(false);
    }
  };

  const fetchScanFindings = async (scanId: string) => {
    setLoadingScan(true);
    try {
      const res = await fetch(`/api/health/results?scanId=${scanId}`);
      const data = await res.json();
      if (data.success) {
        setFindings(data.findings || []);
        // Reset expanded state
        setExpandedFindings({});
      }
    } catch (err) {
      console.error('Failed to fetch findings:', err);
    } finally {
      setLoadingScan(false);
    }
  };

  useEffect(() => {
    fetchScansList();
  }, [projectId]);

  useEffect(() => {
    if (selectedScan) {
      fetchScanFindings(selectedScan.id);
    } else {
      setFindings([]);
    }
  }, [selectedScan]);

  // Polling for running scans
  useEffect(() => {
    const hasRunning = scans.some(s => s.status === 'running');
    if (!hasRunning) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/health/list?projectId=${projectId}`);
        const data = await res.json();
        if (data.success && Array.isArray(data.scans)) {
          setScans(data.scans);
          
          if (selectedScan) {
            const updated = data.scans.find((s: HealthScan) => s.id === selectedScan.id);
            if (updated && updated.status !== selectedScan.status) {
              setSelectedScan(updated);
            }
          }
        }
      } catch (err) {
        console.warn('Error polling scans status:', err);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [scans, selectedScan, projectId]);

  const handleStartScan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetUrl.trim()) return;

    setScanning(true);
    try {
      const res = await fetch('/api/health/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUrl: targetUrl.trim(), projectId })
      });
      const data = await res.json();
      if (data.success && data.scanId) {
        setTargetUrl('');
        fetchScansList(data.scanId);
      } else {
        alert(`Failed to trigger scan: ${data.error || 'Unknown error'}`);
      }
    } catch (err) {
      console.error('Failed starting health check:', err);
      alert('Error launching health scan pipeline.');
    } finally {
      setScanning(false);
    }
  };

  const toggleFinding = (findingId: string) => {
    setExpandedFindings(prev => ({
      ...prev,
      [findingId]: !prev[findingId]
    }));
  };

  const getScoreColor = (score: number | null) => {
    if (score === null) return 'text-muted-soft';
    if (score >= 90) return 'text-[#5db872]'; // Success green
    if (score >= 70) return 'text-[#e8a55a]'; // Accent amber
    return 'text-[#c64545]'; // Error/Critical red
  };

  const getScoreProgressColor = (score: number | null) => {
    if (score === null) return 'stroke-[#e6dfd8]';
    if (score >= 90) return 'stroke-[#5db872]';
    if (score >= 70) return 'stroke-[#e8a55a]';
    return 'stroke-[#c64545]';
  };

  const getPriorityBadgeClass = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'bg-red-50 text-[#c64545] border border-red-200/50';
      case 'medium':
        return 'bg-amber-50 text-[#e8a55a] border border-amber-200/50';
      case 'low':
        return 'bg-blue-50 text-[#5db8a6] border border-blue-200/50';
      default:
        return 'bg-surface-soft text-muted border border-hairline';
    }
  };

  const getCategoryLabel = (cat: string) => {
    switch (cat) {
      case 'performance': return 'Performance';
      case 'seo': return 'SEO & Meta';
      case 'accessibility': return 'Accessibility';
      case 'configuration': return 'DNS & Email';
      case 'security': return 'Security Headers';
      default: return cat;
    }
  };

  // Group findings by priority
  const highPriorityFindings = findings.filter(f => f.priority === 'high');
  const mediumPriorityFindings = findings.filter(f => f.priority === 'medium');
  const lowPriorityFindings = findings.filter(f => f.priority === 'low');
  const infoPriorityFindings = findings.filter(f => f.priority === 'info');

  if (loadingList) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-screen bg-canvas font-dmsans">
        <RefreshCw className="w-6 h-6 text-[#cc785c] animate-spin" />
        <span className="text-xs text-muted-soft mt-2.5">Loading Health Scanner database...</span>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col lg:flex-row h-screen bg-canvas overflow-hidden font-dmsans select-none">
      
      {/* 1. Scans History Sidebar */}
      <div className="w-full lg:w-72 border-b lg:border-b-0 lg:border-r border-hairline bg-surface-soft/45 flex flex-col shrink-0">
        
        {/* Sidebar Header with URL Entry trigger */}
        <div className="p-4 border-b border-hairline">
          <span className="text-xs font-bold text-ink uppercase tracking-wider block mb-3">Audit Public Domain</span>
          
          <form onSubmit={handleStartScan} className="flex gap-2">
            <input
              type="text"
              placeholder="e.g. google.com"
              value={targetUrl}
              onChange={(e) => setTargetUrl(e.target.value)}
              className="flex-1 bg-white border border-[#E5E0DA] text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-[#cc785c] text-ink placeholder-muted-soft"
              disabled={scanning}
            />
            <button
              type="submit"
              disabled={scanning || !targetUrl.trim()}
              className="p-2 bg-[#cc785c] hover:bg-[#a9583e] text-white rounded-lg transition-colors cursor-pointer disabled:opacity-50"
            >
              {scanning ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Plus className="w-3.5 h-3.5" />
              )}
            </button>
          </form>
        </div>

        {/* Scan List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          <div className="text-[10px] font-bold text-muted-soft px-3 py-1 uppercase tracking-wider">
            Previous Checks
          </div>
          
          {scans.map((s) => {
            const isSelected = selectedScan?.id === s.id;
            return (
              <button
                key={s.id}
                onClick={() => setSelectedScan(s)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all text-left cursor-pointer ${
                  isSelected
                    ? 'bg-surface-cream-strong text-ink border-l-3 border-[#cc785c]'
                    : 'hover:bg-surface-soft text-muted hover:text-ink'
                }`}
              >
                <Globe className={`w-4 h-4 ${isSelected ? 'text-[#cc785c]' : 'text-muted-soft'}`} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-ink flex items-center justify-between gap-1">
                    <span>{s.target_url}</span>
                    {s.status === 'running' && (
                      <span className="w-2 h-2 rounded-full bg-blue-500 animate-ping shrink-0" />
                    )}
                  </div>
                  <div className="text-[9px] text-muted-soft truncate mt-0.5 flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <Clock className="w-2.5 h-2.5" />
                      {new Date(s.created_at).toLocaleDateString()}
                    </span>
                    {s.status === 'complete' && s.score !== null && (
                      <span className={`font-bold ${getScoreColor(s.score)}`}>
                        {s.score}/100
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}

          {scans.length === 0 && (
            <div className="text-center py-8 px-4 text-xs text-muted-soft italic leading-normal">
              No websites audited. Enter a domain above to perform a health check.
            </div>
          )}
        </div>
      </div>

      {/* 2. Main Scan Audits Content Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        
        {/* Dynamic Scan Details Top Header */}
        {selectedScan && (
          <div className="p-4 border-b border-hairline bg-canvas flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0 text-left">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-serif text-lg font-normal text-ink">
                  {selectedScan.target_url}
                </h2>
                {selectedScan.status === 'running' && (
                  <span className="text-[9px] font-bold text-blue-700 bg-blue-50 border border-blue-200/50 px-2 py-0.2 rounded-full animate-pulse uppercase tracking-wide">
                    Auditing...
                  </span>
                )}
                {selectedScan.status === 'failed' && (
                  <span className="text-[9px] font-bold text-red-700 bg-red-50 border border-red-200/50 px-2 py-0.2 rounded-full uppercase tracking-wide">
                    Scan Failed
                  </span>
                )}
                {selectedScan.status === 'complete' && (
                  <span className="text-[9px] font-bold text-[#2f7e70] bg-[#e6f4f1] border border-[#5db8a6]/30 px-2 py-0.2 rounded-full uppercase tracking-wide">
                    Complete
                  </span>
                )}
              </div>
              <div className="text-[10px] text-muted-soft mt-0.5">
                Scan ID: {selectedScan.id} • Audited on {new Date(selectedScan.created_at).toLocaleString()}
              </div>
            </div>
          </div>
        )}

        {/* Main Details Viewport */}
        <div className="flex-1 overflow-y-auto p-6 bg-canvas flex flex-col justify-between">
          <div className="flex-1">
            {selectedScan ? (
              loadingScan ? (
                <div className="flex flex-col items-center justify-center py-24">
                  <RefreshCw className="w-6 h-6 text-[#cc785c] animate-spin" />
                  <span className="text-xs text-muted-soft mt-2.5">Fetching technical findings...</span>
                </div>
              ) : selectedScan.status === 'running' ? (
                <div className="flex flex-col items-center justify-center py-24 border border-dashed border-[#E5E0DA] bg-surface-soft/10 rounded-2xl max-w-lg mx-auto text-center p-6 space-y-4">
                  <RefreshCw className="w-8 h-8 text-[#cc785c] animate-spin" />
                  <div className="space-y-1.5">
                    <h4 className="text-sm font-bold text-ink">Health Auditor Scanning Active</h4>
                    <p className="text-xs text-muted-soft leading-normal">
                      Connecting to public endpoints, inspecting SSL certificates, checking security headers (HSTS, CSP, X-Frame-Options), assessing SEO tags, and looking up email security DNS rules (SPF/DMARC). This takes 5-10 seconds. Watch the stream below.
                    </p>
                  </div>
                </div>
              ) : selectedScan.status === 'failed' ? (
                <div className="flex flex-col items-center justify-center py-24 border border-dashed border-[#E5E0DA] bg-surface-soft/10 rounded-2xl max-w-lg mx-auto text-center p-6 space-y-4">
                  <AlertCircle className="w-8 h-8 text-[#c64545]" />
                  <div className="space-y-1.5">
                    <h4 className="text-sm font-bold text-ink">Audit Scan Failed</h4>
                    <p className="text-xs text-muted-soft leading-normal">
                      The domain check failed. Verify that you entered a valid, reachable public domain name (e.g. `github.com`) and that it is not blocking requests.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  
                  {/* Score circle and checklist summary */}
                  <div className="bg-[#FFFFFF] border border-[#E5E0DA] rounded-2xl p-6 flex flex-col md:flex-row items-center gap-8 shadow-2xs">
                    {/* Ring score */}
                    <div className="relative w-32 h-32 flex-shrink-0">
                      <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                        <circle
                          className="stroke-hairline-soft"
                          strokeWidth="8"
                          fill="transparent"
                          r="38"
                          cx="50"
                          cy="50"
                        />
                        <circle
                          className={`transition-all duration-1000 ${getScoreProgressColor(selectedScan.score)}`}
                          strokeWidth="8"
                          strokeDasharray={2 * Math.PI * 38}
                          strokeDashoffset={2 * Math.PI * 38 * (1 - (selectedScan.score || 0) / 100)}
                          strokeLinecap="round"
                          fill="transparent"
                          r="38"
                          cx="50"
                          cy="50"
                        />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className={`text-3xl font-normal font-serif ${getScoreColor(selectedScan.score)}`}>
                          {selectedScan.score !== null ? selectedScan.score : 'N/A'}
                        </span>
                        <span className="text-[9px] uppercase tracking-wider text-muted-soft font-bold">Health Score</span>
                      </div>
                    </div>

                    {/* Stats summary */}
                    <div className="flex-1 space-y-4 text-left">
                      <div>
                        <h3 className="font-serif text-xl font-normal text-ink">Scan Analysis Summary</h3>
                        <p className="text-xs text-muted mt-1 leading-normal">
                          This score is based on {selectedScan.checks_passed + selectedScan.checks_failed} technical checks. Standard weights deduct penalties for insecure connections, missing configuration tags, and unprotected mail servers.
                        </p>
                      </div>

                      <div className="flex gap-6">
                        <div className="flex items-center gap-2 text-xs font-semibold text-[#191919]">
                          <CheckCircle2 className="w-4 h-4 text-[#5db872]" />
                          <span>{selectedScan.checks_passed} Checks Passed</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs font-semibold text-[#191919]">
                          <XCircle className="w-4 h-4 text-[#c64545]" />
                          <span>{selectedScan.checks_failed} Recommendations</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Findings list grouped by priority */}
                  <div className="space-y-4 text-left">
                    <h3 className="font-serif text-lg font-normal text-ink border-b border-hairline pb-2">
                      Technical Audit Findings ({findings.length})
                    </h3>

                    {findings.length === 0 ? (
                      <div className="text-center py-12 border border-dashed border-[#E5E0DA] rounded-xl text-xs text-muted-soft italic">
                        Clean audit! No issues detected.
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        {/* High priority */}
                        {highPriorityFindings.length > 0 && (
                          <div className="space-y-2">
                            <div className="text-[10px] font-bold text-[#c64545] tracking-wider uppercase pl-1">
                              High Priority Issues ({highPriorityFindings.length})
                            </div>
                            {highPriorityFindings.map(f => renderFindingRow(f))}
                          </div>
                        )}

                        {/* Medium priority */}
                        {mediumPriorityFindings.length > 0 && (
                          <div className="space-y-2 pt-2">
                            <div className="text-[10px] font-bold text-[#e8a55a] tracking-wider uppercase pl-1">
                              Medium Priority Issues ({mediumPriorityFindings.length})
                            </div>
                            {mediumPriorityFindings.map(f => renderFindingRow(f))}
                          </div>
                        )}

                        {/* Low priority */}
                        {lowPriorityFindings.length > 0 && (
                          <div className="space-y-2 pt-2">
                            <div className="text-[10px] font-bold text-[#5db8a6] tracking-wider uppercase pl-1">
                              Low Priority Issues ({lowPriorityFindings.length})
                            </div>
                            {lowPriorityFindings.map(f => renderFindingRow(f))}
                          </div>
                        )}

                        {/* Info priority */}
                        {infoPriorityFindings.length > 0 && (
                          <div className="space-y-2 pt-2">
                            <div className="text-[10px] font-bold text-muted-soft tracking-wider uppercase pl-1">
                              Informational Metrics ({infoPriorityFindings.length})
                            </div>
                            {infoPriorityFindings.map(f => renderFindingRow(f))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  
                  {/* Security auditor disclaimer */}
                  <div className="bg-[#FFFFFF] border border-amber-200/50 rounded-2xl p-4 flex gap-3.5 text-left text-xs bg-amber-50/25">
                    <Shield className="w-5 h-5 text-[#e8a55a] shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold text-ink uppercase tracking-wide text-[10px] block mb-1">Defensive Health Audit Disclaimer</span>
                      <p className="text-muted-soft leading-relaxed">
                        This auditor collects public headers, DNS records, and standard HTML meta information. It does NOT engage in penetration testing, directory brute-forcing, active port scanning, or malicious vulnerability probing. It is designed to evaluate frontend readiness, SEO best practices, and email validation records.
                      </p>
                    </div>
                  </div>

                </div>
              )
            ) : (
              // Empty State
              <div className="flex flex-col items-center justify-center py-24 max-w-xl mx-auto text-center space-y-6">
                <div className="w-16 h-16 rounded-full bg-[#cc785c]/10 flex items-center justify-center border border-[#cc785c]/20">
                  <Globe className="w-8 h-8 text-[#cc785c]" />
                </div>

                <div className="space-y-2">
                  <h2 className="font-serif text-2xl text-ink font-normal">Website Health Auditor</h2>
                  <p className="text-sm text-body leading-relaxed max-w-md mx-auto font-dmsans">
                    Validate SSL handshake states, text compressions, caching rules, robots/sitemaps availability, security headers, and DNS SPF/DMARC configurations defensively in under 10 seconds.
                  </p>
                </div>

                <div className="bg-[#FFFFFF] border border-hairline p-4 rounded-xl text-left text-xs text-muted-soft max-w-md flex gap-2.5">
                  <Shield className="w-4 h-4 text-muted-soft shrink-0 mt-0.5" />
                  <span><strong>Defensive Scope:</strong> Non-intrusive metadata analysis only. No active pentesting or aggressive scanning is performed.</span>
                </div>
              </div>
            )}
          </div>

          {/* Real-time event stream */}
          <div className="mt-8 border-t border-hairline pt-6 shrink-0 text-left">
            <h3 className="text-xs font-bold uppercase tracking-wider text-ink mb-3">Health Check Event Stream</h3>
            <LiveFeed 
              projectId={projectId} 
              filterTypes={[
                StreamEventType.AGENT_STARTED,
                StreamEventType.PRICE_CHECKING,
                StreamEventType.BROWSER_SEARCHING,
                StreamEventType.LEADS_SEARCHING,
                StreamEventType.LEAD_RESEARCHING,
                StreamEventType.AGENT_COMPLETE,
                StreamEventType.STREAM_ERROR
              ]}
              maxHeight="150px"
              compact={true}
            />
          </div>

        </div>
      </div>
    </div>
  );

  function renderFindingRow(f: HealthFinding) {
    const isExpanded = !!expandedFindings[f.id];
    return (
      <div 
        key={f.id}
        className="bg-white border border-[#E5E0DA] rounded-xl overflow-hidden shadow-2xs hover:border-[#cc785c]/35 transition-all"
      >
        <button
          onClick={() => toggleFinding(f.id)}
          className="w-full px-4 py-3 flex items-center justify-between gap-4 cursor-pointer hover:bg-surface-soft/10 text-left"
        >
          <div className="flex items-center gap-3 min-w-0">
            <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full shrink-0 ${getPriorityBadgeClass(f.priority)}`}>
              {f.priority}
            </span>
            <span className="text-xs font-bold text-ink truncate">
              {f.title}
            </span>
            <span className="text-[10px] text-muted-soft bg-surface-soft px-2 py-0.2 rounded border border-hairline/50 shrink-0">
              {getCategoryLabel(f.category)}
            </span>
          </div>

          <div className="text-muted-soft shrink-0">
            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </div>
        </button>

        {isExpanded && (
          <div className="px-4 pb-4 pt-1 border-t border-hairline/35 space-y-3 bg-surface-soft/5">
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-muted uppercase tracking-wider block">Description</span>
              <p className="text-xs text-body leading-relaxed">{f.description}</p>
            </div>

            <div className="space-y-1">
              <span className="text-[10px] font-bold text-ink uppercase tracking-wider block">Suggested Recommendation</span>
              <p className="text-xs text-body font-semibold leading-relaxed bg-[#FFFFFF] p-2.5 rounded-lg border border-hairline">
                {f.recommendation}
              </p>
            </div>

            {f.docs_url && (
              <a
                href={f.docs_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[10px] font-bold text-[#cc785c] hover:underline"
              >
                <span>Learn more on MDN / Google Web Dev</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        )}
      </div>
    );
  }
}
