'use client';

import React, { useState, useEffect } from 'react';
import DDInput from './DDInput';
import DDReport from './DDReport';
import LiveFeed from '../stream/LiveFeed';
import { StreamEventType } from '../../types';
import { 
  Building2, 
  Plus, 
  Sparkles, 
  RefreshCw, 
  Calendar,
  AlertCircle,
  FileCheck2
} from 'lucide-react';

interface DDReportSummary {
  id: string;
  target_name: string;
  target_url: string | null;
  target_domain: string | null;
  status: 'running' | 'complete' | 'failed';
  pdf_url: string | null;
  report_data?: {
    overall_score?: number;
    recommendation?: string;
  };
  created_at: string;
}

interface DDDashboardProps {
  projectId: string;
  userId: string;
}

export default function DDDashboard({ projectId, userId }: DDDashboardProps) {
  const [reports, setReports] = useState<DDReportSummary[]>([]);
  const [selectedReport, setSelectedReport] = useState<DDReportSummary | null>(null);
  const [reportDetails, setReportDetails] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [isInputOpen, setIsInputOpen] = useState(false);

  const fetchReports = async (selectReportId?: string) => {
    try {
      const res = await fetch(`/api/due-diligence/list?projectId=${projectId}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.reports)) {
        setReports(data.reports);

        if (data.reports.length > 0) {
          const defaultSelect = selectReportId
            ? data.reports.find((r: any) => r.id === selectReportId) || data.reports[0]
            : data.reports[0];
          setSelectedReport(defaultSelect);
        } else {
          setSelectedReport(null);
          setReportDetails(null);
        }
      }
    } catch (err) {
      console.error('Failed to fetch due diligence reports list:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchReportDetails = async (reportId: string) => {
    setLoadingDetails(true);
    try {
      const res = await fetch(`/api/due-diligence/report?reportId=${reportId}`);
      const data = await res.json();
      if (data.success) {
        setReportDetails(data);
      }
    } catch (err) {
      console.error('Failed to load due diligence report details:', err);
    } finally {
      setLoadingDetails(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [projectId]);

  useEffect(() => {
    if (selectedReport) {
      fetchReportDetails(selectedReport.id);
    } else {
      setReportDetails(null);
    }
  }, [selectedReport]);

  // Set up polling for active crawling reports
  useEffect(() => {
    const activeRuns = reports.some(r => r.status === 'running');
    if (!activeRuns) return;

    const interval = setInterval(() => {
      fetch(`/api/due-diligence/list?projectId=${projectId}`)
        .then(res => res.json())
        .then(data => {
          if (data.success && Array.isArray(data.reports)) {
            setReports(data.reports);
            // If the currently selected report has changed status, reload its details
            if (selectedReport) {
              const updated = data.reports.find((r: any) => r.id === selectedReport.id);
              if (updated && updated.status !== selectedReport.status) {
                setSelectedReport(updated);
              }
            }
          }
        })
        .catch(err => console.warn('Failed to poll due diligence list updates:', err));
    }, 4000);

    return () => clearInterval(interval);
  }, [reports, selectedReport, projectId]);

  const handleStartSuccess = (reportId: string) => {
    // Reload and auto-select the newly added report
    fetchReports(reportId);
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-screen bg-canvas font-dmsans">
        <RefreshCw className="w-6 h-6 text-[#cc785c] animate-spin" />
        <span className="text-xs text-muted-soft mt-2.5">Syncing Due Diligence Database...</span>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col lg:flex-row h-screen bg-canvas overflow-hidden font-dmsans select-none">
      
      {/* 1. Tracked Startups Sidebar */}
      <div className="w-full lg:w-64 border-b lg:border-b-0 lg:border-r border-hairline bg-surface-soft/45 flex flex-col shrink-0">
        
        {/* Sidebar Header */}
        <div className="p-4 border-b border-hairline flex items-center justify-between">
          <span className="text-xs font-bold text-ink uppercase tracking-wider">Tracked Startups</span>
          <button
            onClick={() => setIsInputOpen(true)}
            className="p-1 hover:bg-surface-cream-strong rounded text-[#cc785c] hover:text-[#a9583e] transition-colors cursor-pointer"
            title="Run Due Diligence"
          >
            <Plus className="w-4.5 h-4.5" />
          </button>
        </div>

        {/* Startup Report Items List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {reports.map((r) => {
            const isSelected = selectedReport?.id === r.id;
            return (
              <button
                key={r.id}
                onClick={() => setSelectedReport(r)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all text-left cursor-pointer ${
                  isSelected
                    ? 'bg-surface-cream-strong text-ink border-l-3 border-[#cc785c]'
                    : 'hover:bg-surface-soft text-muted hover:text-ink'
                }`}
              >
                <Building2 className={`w-4 h-4 ${isSelected ? 'text-[#cc785c]' : 'text-muted-soft'}`} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-ink flex items-center justify-between gap-1">
                    <span>{r.target_name}</span>
                    {r.status === 'running' && (
                      <span className="w-2 h-2 rounded-full bg-blue-500 animate-ping shrink-0" />
                    )}
                  </div>
                  <div className="text-[10px] text-muted-soft truncate mt-0.5 flex items-center justify-between">
                    <span>{r.target_domain}</span>
                    {r.status === 'complete' && r.report_data?.overall_score && (
                      <span className="font-bold text-[#cc785c]">{r.report_data.overall_score}/100</span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}

          {reports.length === 0 && (
            <div className="text-center py-8 px-4 text-xs text-muted-soft italic leading-normal">
              No startups analyzed. Enter a startup profile to trigger agents.
            </div>
          )}
        </div>
      </div>

      {/* 2. Main Dashboard Content Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        
        {/* Top Header Controls bar */}
        {selectedReport ? (
          <div className="p-4 border-b border-hairline bg-canvas flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0 text-left">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-serif text-lg font-normal text-ink">
                  {selectedReport.target_name}
                </h2>
                <span className="text-[10px] text-muted bg-surface-soft border border-hairline px-2 py-0.5 rounded-full uppercase tracking-wider">
                  {selectedReport.target_domain}
                </span>
                
                {selectedReport.status === 'running' && (
                  <span className="text-[9px] font-bold text-blue-700 bg-blue-50 border border-blue-200/50 px-2 py-0.2 rounded-full animate-pulse uppercase tracking-wide">
                    Running...
                  </span>
                )}
                {selectedReport.status === 'failed' && (
                  <span className="text-[9px] font-bold text-red-700 bg-red-50 border border-red-200/50 px-2 py-0.2 rounded-full uppercase tracking-wide">
                    Failed
                  </span>
                )}
              </div>
              
              <div className="text-[10px] text-muted-soft mt-0.5 flex items-center gap-1.5 font-dmsans">
                <span>Created: {new Date(selectedReport.created_at).toLocaleString()}</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsInputOpen(true)}
                className="flex items-center gap-1 px-3 py-1.5 bg-[#cc785c] hover:bg-[#a9583e] text-white rounded-lg text-xs font-semibold cursor-pointer transition-colors shadow-2xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Run Due Diligence</span>
              </button>
            </div>
          </div>
        ) : null}

        {/* Main Viewport Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-canvas flex flex-col justify-between">
          <div className="flex-1">
            {selectedReport ? (
              loadingDetails ? (
                <div className="flex flex-col items-center justify-center py-24">
                  <RefreshCw className="w-6 h-6 text-[#cc785c] animate-spin" />
                  <span className="text-xs text-muted-soft mt-2.5">Parsing intelligence records...</span>
                </div>
              ) : selectedReport.status === 'running' ? (
                <div className="flex flex-col items-center justify-center py-24 border border-dashed border-[#E5E0DA] bg-surface-soft/10 rounded-2xl max-w-lg mx-auto text-center p-6 space-y-4">
                  <RefreshCw className="w-8 h-8 text-[#cc785c] animate-spin" />
                  <div className="space-y-1.5">
                    <h4 className="text-sm font-bold text-ink">AI Research Pipeline in Progress</h4>
                    <p className="text-xs text-muted-soft leading-normal">
                      The parallel crawling agents are searching the web and analyzing market size, financials, products, and legal flags. This takes 30-45 seconds. Watch the live stream log below.
                    </p>
                  </div>
                </div>
              ) : selectedReport.status === 'failed' ? (
                <div className="flex flex-col items-center justify-center py-24 border border-dashed border-[#E5E0DA] bg-surface-soft/10 rounded-2xl max-w-lg mx-auto text-center p-6 space-y-4">
                  <AlertCircle className="w-8 h-8 text-[#c64545]" />
                  <div className="space-y-1.5">
                    <h4 className="text-sm font-bold text-ink">Due Diligence Pipeline Failed</h4>
                    <p className="text-xs text-muted-soft leading-normal">
                      The research agents encountered errors while trying to query external APIs or synthethise thesis. Click "Run Due Diligence" above to launch a new report check.
                    </p>
                  </div>
                </div>
              ) : reportDetails ? (
                <DDReport 
                  report={selectedReport} 
                  sections={reportDetails.sections} 
                  onRefresh={() => setSelectedReport(selectedReport)}
                />
              ) : null
            ) : (
              // Premium empty state layout
              <div className="flex flex-col items-center justify-center py-24 max-w-xl mx-auto text-center space-y-6">
                
                <div className="w-16 h-16 rounded-full bg-[#cc785c]/10 flex items-center justify-center border border-[#cc785c]/20">
                  <FileCheck2 className="w-8 h-8 text-[#cc785c]" />
                </div>

                <div className="space-y-2">
                  <h2 className="font-serif text-2xl text-ink font-normal">AI Due Diligence Engine</h2>
                  <p className="text-sm text-body leading-relaxed max-w-md mx-auto font-dmsans">
                    Spawn a multi-role analyst team to run investment-grade diligence on any competitor, partner, or target startup URL. Generates formatted reports and downloadable PDF packages.
                  </p>
                </div>

                <button
                  onClick={() => setIsInputOpen(true)}
                  className="px-6 py-2.5 bg-[#cc785c] hover:bg-[#a9583e] text-white rounded-lg text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer scale-105"
                >
                  <Plus className="w-4 h-4" />
                  <span>Analyze Your First Startup</span>
                </button>
              </div>
            )}
          </div>

          <div className="mt-8 border-t border-hairline pt-6 shrink-0">
            <h3 className="text-xs font-bold uppercase tracking-wider text-ink mb-3 text-left">Live Research Agent Stream</h3>
            <LiveFeed 
              projectId={projectId} 
              filterTypes={[
                StreamEventType.STREAM_START,
                StreamEventType.LEADS_SEARCHING,
                StreamEventType.AD_INTEL_SCRAPING,
                StreamEventType.LEAD_RESEARCHING,
                StreamEventType.BROWSER_SEARCHING,
                StreamEventType.PRICE_CHECKING,
                StreamEventType.JUDGE_EVALUATING,
                StreamEventType.ORCHESTRATOR_SYNTHESIZING,
                StreamEventType.ORCHESTRATOR_PLANNING,
                StreamEventType.ORCHESTRATOR_COMPLETE,
                StreamEventType.STREAM_END
              ]}
              maxHeight="160px"
              compact={true}
            />
          </div>
        </div>
      </div>

      {/* Input dialog pop-up */}
      <DDInput 
        isOpen={isInputOpen} 
        onClose={() => setIsInputOpen(false)} 
        projectId={projectId} 
        userId={userId} 
        onSuccess={handleStartSuccess} 
      />
    </div>
  );
}
