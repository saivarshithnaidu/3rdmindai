'use client';

import React, { useState, useEffect } from 'react';
import MentionCard from './MentionCard';
import LiveFeed from '../stream/LiveFeed';
import { StreamEventType } from '../../types';
import { 
  ShieldCheck, Plus, Sparkles, RefreshCw, AlertCircle, Eye, 
  TrendingUp, Activity, BarChart3, Newspaper, Calendar, CheckSquare, X
} from 'lucide-react';

interface Monitor {
  id: string;
  project_id: string;
  brand_name: string;
  keywords: string[];
  platforms: string[];
  check_interval: number;
  auto_respond: boolean;
  last_checked_at: string | null;
  created_at: string;
}

interface Mention {
  id: string;
  monitor_id: string;
  platform: string;
  source_url: string;
  author: string | null;
  content: string;
  sentiment: 'positive' | 'neutral' | 'negative';
  sentiment_score: number | null;
  urgency: 'critical' | 'high' | 'medium' | 'low';
  response_draft: string | null;
  response_sent: boolean;
  response_url: string | null;
  found_at: string;
}

interface ReputationReport {
  id: string;
  monitor_id: string;
  week_start: string;
  total_mentions: number;
  positive_count: number;
  neutral_count: number;
  negative_count: number;
  avg_sentiment: number;
  top_topics: { topics: string[] };
  summary: string;
  created_at: string;
}

interface ReputationDashboardProps {
  projectId: string;
  userId: string;
}

export default function ReputationDashboard({ projectId, userId }: ReputationDashboardProps) {
  const [monitors, setMonitors] = useState<Monitor[]>([]);
  const [selectedMonitor, setSelectedMonitor] = useState<Monitor | null>(null);
  const [mentions, setMentions] = useState<Mention[]>([]);
  const [reports, setReports] = useState<ReputationReport[]>([]);

  const [loading, setLoading] = useState(true);
  const [loadingMentions, setLoadingMentions] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [reporting, setReporting] = useState(false);
  
  // Create Monitor form states
  const [isInputOpen, setIsInputOpen] = useState(false);
  const [brandName, setBrandName] = useState('');
  const [keywordsText, setKeywordsText] = useState('');
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(['reddit', 'twitter', 'g2']);
  const [error, setError] = useState('');

  const fetchMonitors = async (selectMonitorId?: string) => {
    try {
      const res = await fetch(`/api/reputation/list?projectId=${projectId}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.monitors)) {
        setMonitors(data.monitors);

        if (data.monitors.length > 0) {
          const defaultSelect = selectMonitorId
            ? data.monitors.find((m: any) => m.id === selectMonitorId) || data.monitors[0]
            : data.monitors[0];
          setSelectedMonitor(defaultSelect);
        } else {
          setSelectedMonitor(null);
          setMentions([]);
          setReports([]);
        }
      }
    } catch (err) {
      console.error('Failed to fetch monitors list:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchMentionsAndReports = async (monitorId: string) => {
    setLoadingMentions(true);
    try {
      const mentionsRes = await fetch(`/api/reputation/mentions?monitorId=${monitorId}`);
      const mentionsData = await mentionsRes.json();
      if (mentionsData.success) {
        setMentions(mentionsData.mentions || []);
      }

      const reportsRes = await fetch(`/api/reputation/reports?monitorId=${monitorId}`);
      const reportsData = await reportsRes.json();
      if (reportsData.success) {
        setReports(reportsData.reports || []);
      }
    } catch (err) {
      console.error('Failed to load monitor details:', err);
    } finally {
      setLoadingMentions(false);
    }
  };

  useEffect(() => {
    fetchMonitors();
  }, [projectId]);

  useEffect(() => {
    if (selectedMonitor) {
      fetchMentionsAndReports(selectedMonitor.id);
    } else {
      setMentions([]);
      setReports([]);
    }
  }, [selectedMonitor]);

  // Set up polling for active background crawls
  useEffect(() => {
    if (!selectedMonitor || !scanning) return;

    const interval = setInterval(() => {
      fetch(`/api/reputation/mentions?monitorId=${selectedMonitor.id}`)
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            setMentions(data.mentions || []);
          }
        })
        .catch(err => console.warn('Failed to poll mentions updates:', err));
    }, 4000);

    return () => clearInterval(interval);
  }, [scanning, selectedMonitor]);

  const handleCreateMonitor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!brandName) {
      setError('Brand Name is required');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/reputation/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          brandName,
          keywords: keywordsText.split(',').map((k) => k.trim()).filter(Boolean),
          platforms: selectedPlatforms,
          checkInterval: 24,
          autoRespond: false
        })
      });
      const data = await res.json();
      if (data.success && data.monitor) {
        setBrandName('');
        setKeywordsText('');
        setIsInputOpen(false);
        fetchMonitors(data.monitor.id);
      } else {
        setError(data.error || 'Failed to create brand monitor.');
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleScanNow = async () => {
    if (!selectedMonitor) return;
    setScanning(true);
    try {
      const res = await fetch('/api/reputation/mentions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ monitorId: selectedMonitor.id })
      });
      const data = await res.json();
      if (data.success) {
        // Wait 10 seconds for agents to return first data, then turn off scanning spinner
        setTimeout(() => {
          setScanning(false);
          fetchMentionsAndReports(selectedMonitor.id);
        }, 10000);
      } else {
        setScanning(false);
      }
    } catch (err) {
      console.error(err);
      setScanning(false);
    }
  };

  const handleCompileReport = async () => {
    if (!selectedMonitor) return;
    setReporting(true);
    try {
      const res = await fetch('/api/reputation/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ monitorId: selectedMonitor.id })
      });
      const data = await res.json();
      if (data.success) {
        fetchMentionsAndReports(selectedMonitor.id);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setReporting(false);
    }
  };

  const handlePlatformCheckbox = (plat: string) => {
    if (selectedPlatforms.includes(plat)) {
      setSelectedPlatforms(selectedPlatforms.filter(p => p !== plat));
    } else {
      setSelectedPlatforms([...selectedPlatforms, plat]);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-screen bg-canvas font-dmsans">
        <RefreshCw className="w-6 h-6 text-[#cc785c] animate-spin" />
        <span className="text-xs text-muted-soft mt-2.5">Syncing Reputation Database...</span>
      </div>
    );
  }

  // Sentiment analytics calculations
  const total = mentions.length;
  const positiveCount = mentions.filter(m => m.sentiment === 'positive').length;
  const negativeCount = mentions.filter(m => m.sentiment === 'negative').length;
  const averageSentiment = total > 0 ? (mentions.reduce((acc, m) => acc + (m.sentiment_score || 0), 0) / total) : 0.0;

  return (
    <div className="flex-1 flex flex-col lg:flex-row h-screen bg-canvas overflow-hidden font-dmsans select-none">
      
      {/* 1. Brand Monitors Sidebar */}
      <div className="w-full lg:w-64 border-b lg:border-b-0 lg:border-r border-hairline bg-surface-soft/45 flex flex-col shrink-0">
        
        {/* Sidebar Header */}
        <div className="p-4 border-b border-hairline flex items-center justify-between">
          <span className="text-xs font-bold text-ink uppercase tracking-wider">Monitored Brands</span>
          <button
            onClick={() => setIsInputOpen(true)}
            className="p-1 hover:bg-surface-cream-strong rounded text-[#cc785c] hover:text-[#a9583e] transition-colors cursor-pointer"
            title="Add Brand Monitor"
          >
            <Plus className="w-4.5 h-4.5" />
          </button>
        </div>

        {/* Brands Items list */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {monitors.map((m) => {
            const isSelected = selectedMonitor?.id === m.id;
            return (
              <button
                key={m.id}
                onClick={() => setSelectedMonitor(m)}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-semibold transition-all text-left cursor-pointer ${
                  isSelected
                    ? 'bg-surface-cream-strong text-ink border-l-3 border-[#cc785c]'
                    : 'hover:bg-surface-soft text-muted hover:text-ink'
                }`}
              >
                <Activity className={`w-4 h-4 shrink-0 ${isSelected ? 'text-[#cc785c]' : 'text-muted-soft'}`} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-ink">{m.brand_name}</div>
                  <div className="text-[10px] text-muted-soft truncate mt-0.5">
                    {m.platforms.map(p=>p.slice(0,2)).join(', ').toUpperCase()}
                  </div>
                </div>
              </button>
            );
          })}

          {monitors.length === 0 && (
            <div className="text-center py-8 px-4 text-xs text-muted-soft italic leading-normal">
              No brand monitors set. Create a brand watch to start.
            </div>
          )}
        </div>
      </div>

      {/* 2. Main Workspace Dashboard */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        
        {/* Top Header bar with selector actions */}
        {selectedMonitor ? (
          <div className="p-4 border-b border-hairline bg-canvas flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0 text-left">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-serif text-lg font-normal text-ink">
                  {selectedMonitor.brand_name}
                </h2>
                <span className="text-[10px] text-muted bg-surface-soft border border-hairline px-2 py-0.5 rounded-full uppercase tracking-wider">
                  Check: {selectedMonitor.check_interval}h
                </span>
              </div>
              
              <div className="text-[10px] text-muted-soft mt-0.5 flex items-center gap-1.5 font-dmsans">
                {selectedMonitor.last_checked_at && (
                  <span>Last Checked: {new Date(selectedMonitor.last_checked_at).toLocaleString()}</span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleScanNow}
                disabled={scanning}
                className="flex items-center gap-1 px-3 py-1.5 bg-[#cc785c] hover:bg-[#a9583e] text-white rounded-lg text-xs font-bold cursor-pointer transition-colors shadow-2xs disabled:opacity-50"
              >
                {scanning ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Eye className="w-3.5 h-3.5" />}
                <span>{scanning ? 'Scanning Platforms...' : 'Scan Now'}</span>
              </button>
            </div>
          </div>
        ) : null}

        {/* Dashboard Content Workspace viewport */}
        <div className="flex-1 overflow-y-auto p-6 bg-canvas flex flex-col justify-between">
          <div className="flex-1">
            {selectedMonitor ? (
              loadingMentions ? (
                <div className="flex flex-col items-center justify-center py-24">
                  <RefreshCw className="w-6 h-6 text-[#cc785c] animate-spin" />
                  <span className="text-xs text-muted-soft mt-2.5">Syncing social brand indexes...</span>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Metrics Row Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-white border border-hairline p-4 rounded-xl text-center space-y-1">
                      <span className="text-[9px] font-bold uppercase tracking-wider text-muted-soft">Total Mentions</span>
                      <div className="font-serif text-lg font-bold text-ink">{total}</div>
                    </div>
                    
                    <div className="bg-white border border-hairline p-4 rounded-xl text-center space-y-1">
                      <span className="text-[9px] font-bold uppercase tracking-wider text-muted-soft">Net Sentiment</span>
                      <div className={`font-serif text-lg font-bold ${averageSentiment > 0.1 ? 'text-green-600' : averageSentiment < -0.1 ? 'text-red-600' : 'text-slate-600'}`}>
                        {averageSentiment > 0 ? `+${averageSentiment.toFixed(2)}` : averageSentiment.toFixed(2)}
                      </div>
                    </div>

                    <div className="bg-white border border-hairline p-4 rounded-xl text-center space-y-1">
                      <span className="text-[9px] font-bold uppercase tracking-wider text-muted-soft">Positive Signals</span>
                      <div className="font-serif text-lg font-bold text-green-600">{positiveCount}</div>
                    </div>

                    <div className="bg-white border border-hairline p-4 rounded-xl text-center space-y-1">
                      <span className="text-[9px] font-bold uppercase tracking-wider text-muted-soft">Critical/Negative</span>
                      <div className="font-serif text-lg font-bold text-red-600">{negativeCount}</div>
                    </div>
                  </div>

                  {/* Core Feed & Report Split Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    
                    {/* Mentions Feed (Left 2 columns) */}
                    <div className="md:col-span-2 space-y-4">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-ink border-b border-hairline pb-2 text-left">Mentions Stream Feed</h3>
                      <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1">
                        {mentions.map((m) => (
                          <MentionCard key={m.id} mention={m} onUpdate={() => fetchMentionsAndReports(selectedMonitor.id)} />
                        ))}

                        {mentions.length === 0 && (
                          <div className="text-center py-12 border border-dashed border-hairline rounded-xl text-xs text-muted-soft bg-surface-soft/10">
                            No brand mentions tracked yet. Click Scan Now.
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Weekly Summaries Sidebar (Right 1 column) */}
                    <div className="md:col-span-1 space-y-4 text-left">
                      <div className="flex justify-between items-center border-b border-hairline pb-2">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-ink">Weekly Summaries</h3>
                        
                        <button
                          onClick={handleCompileReport}
                          disabled={reporting}
                          className="flex items-center gap-1.5 px-2 py-1 bg-surface-cream-strong hover:bg-surface-cream-strong/80 text-ink rounded-lg text-[9px] font-bold border border-hairline cursor-pointer disabled:opacity-50"
                        >
                          {reporting ? <RefreshCw className="w-2.5 h-2.5 animate-spin" /> : <BarChart3 className="w-2.5 h-2.5" />}
                          <span>Compile Report</span>
                        </button>
                      </div>

                      <div className="space-y-3 max-h-[500px] overflow-y-auto">
                        {reports.map((rep) => (
                          <div key={rep.id} className="border border-hairline bg-surface-soft/20 rounded-xl p-4 space-y-2 text-[10px]">
                            <div className="flex justify-between items-center font-bold text-ink border-b border-hairline/40 pb-1.5 mb-1.5">
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3.5 h-3.5 text-muted-soft" />
                                <span>Week of {rep.week_start}</span>
                              </span>
                              <span className={`px-1.5 py-0.2 rounded border text-[8px] ${
                                rep.avg_sentiment > 0.1 ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'
                              }`}>
                                Sentiment: {rep.avg_sentiment.toFixed(2)}
                              </span>
                            </div>
                            <div className="text-muted leading-relaxed font-inter whitespace-pre-wrap">{rep.summary}</div>
                          </div>
                        ))}

                        {reports.length === 0 && (
                          <div className="text-center py-8 text-[10px] text-muted-soft italic">
                            No summaries compiled. Click Compile Report.
                          </div>
                        )}
                      </div>
                    </div>

                  </div>
                </div>
              )
            ) : (
              // Empty state
              <div className="flex flex-col items-center justify-center py-24 max-w-xl mx-auto text-center space-y-6">
                
                <div className="w-16 h-16 rounded-full bg-[#cc785c]/10 flex items-center justify-center border border-[#cc785c]/20">
                  <ShieldCheck className="w-8 h-8 text-[#cc785c]" />
                </div>

                <div className="space-y-2">
                  <h2 className="font-serif text-2xl text-ink font-normal">Brand Reputation Monitor</h2>
                  <p className="text-sm text-body leading-relaxed max-w-md mx-auto font-dmsans">
                    Scrape brand mentions on Google, Reddit, Twitter/X, and G2 automatically. Run sentiment analysis and compile weekly summaries with context-aware reply drafts.
                  </p>
                </div>

                <button
                  onClick={() => setIsInputOpen(true)}
                  className="px-6 py-2.5 bg-[#cc785c] hover:bg-[#a9583e] text-white rounded-lg text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer scale-105"
                >
                  <Plus className="w-4 h-4" />
                  <span>Setup Brand Monitor</span>
                </button>
              </div>
            )}
          </div>

          {/* Live stream */}
          <div className="mt-8 border-t border-hairline pt-6 shrink-0">
            <h3 className="text-xs font-bold uppercase tracking-wider text-ink mb-3 text-left">Live Reputation Scanner Stream</h3>
            <LiveFeed 
              projectId={projectId} 
              filterTypes={[
                StreamEventType.AD_INTEL_SCRAPING,
                StreamEventType.AGENT_THINKING,
                StreamEventType.LEAD_FOUND,
                StreamEventType.STREAM_ERROR,
                StreamEventType.ORCHESTRATOR_COMPLETE,
                StreamEventType.AGENT_COMPLETE
              ]}
              maxHeight="160px"
              compact={true}
            />
          </div>
        </div>
      </div>

      {/* Setup brand watch popup dialog modal */}
      {isInputOpen && (
        <div className="fixed inset-0 bg-[#141413]/40 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fadeIn font-dmsans">
          <div className="w-full max-w-md bg-[#FFFFFF] border border-[#E5E0DA] rounded-2xl shadow-lg flex flex-col overflow-hidden animate-slideUp text-left">
            
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-hairline bg-[#FAF9F5]">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#cc785c]" />
                <span className="text-xs font-bold uppercase tracking-wider text-ink">Setup Reputation Monitor</span>
              </div>
              <button 
                onClick={() => setIsInputOpen(false)}
                className="p-1 hover:bg-surface-cream-strong rounded text-muted hover:text-ink transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleCreateMonitor} className="p-5 space-y-4">
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 text-[11px] text-red-700 rounded-lg font-medium">
                  {error}
                </div>
              )}

              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-soft">Brand Name</label>
                <input
                  type="text"
                  placeholder="e.g. 3RDMIND, Razorpay"
                  value={brandName}
                  onChange={(e) => setBrandName(e.target.value)}
                  disabled={loading}
                  className="w-full bg-transparent border border-[#E5E0DA] focus:border-[#cc785c] rounded-xl px-3 py-2 text-xs text-ink focus:outline-none transition-all placeholder-muted-soft"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-soft">Brand Keywords (Comma separated)</label>
                <input
                  type="text"
                  placeholder="e.g. 3rdmind app, 3rdmind feedback"
                  value={keywordsText}
                  onChange={(e) => setKeywordsText(e.target.value)}
                  disabled={loading}
                  className="w-full bg-transparent border border-[#E5E0DA] focus:border-[#cc785c] rounded-xl px-3 py-2 text-xs text-ink focus:outline-none transition-all placeholder-muted-soft"
                />
              </div>

              {/* Platforms Checklist checkboxes */}
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-soft block">Monitor Platforms</label>
                <div className="grid grid-cols-2 gap-2 text-xs text-ink">
                  {['reddit', 'twitter', 'linkedin', 'g2'].map((plat) => (
                    <label key={plat} className="flex items-center gap-2 cursor-pointer capitalize">
                      <input
                        type="checkbox"
                        checked={selectedPlatforms.includes(plat)}
                        onChange={() => handlePlatformCheckbox(plat)}
                        className="rounded border-[#E5E0DA] text-[#cc785c] focus:ring-[#cc785c] w-3.5 h-3.5 cursor-pointer"
                      />
                      <span>{plat}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-hairline">
                <button
                  type="button"
                  onClick={() => setIsInputOpen(false)}
                  className="px-4 py-2 border border-[#E5E0DA] hover:bg-surface-soft text-xs font-semibold text-muted hover:text-ink rounded-xl transition-all cursor-pointer"
                  disabled={loading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#cc785c] hover:bg-[#a9583e] text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  disabled={loading}
                >
                  {loading ? (
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : null}
                  <span>{loading ? 'Adding Watch...' : 'Add Monitor Watch'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
