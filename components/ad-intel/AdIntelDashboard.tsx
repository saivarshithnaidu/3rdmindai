'use client';

import React, { useState, useEffect } from 'react';
import { CompetitorProfile, CompetitorAd, AdIntelReport, StreamEventType } from '../../types';
import CompetitorInput from './CompetitorInput';
import IntelReport from './IntelReport';
import LiveFeed from '../stream/LiveFeed';
import { 
  Globe, 
  Plus, 
  Search, 
  Sparkles, 
  TrendingUp, 
  RefreshCw, 
  Calendar,
  AlertCircle
} from 'lucide-react';

interface AdIntelDashboardProps {
  projectId: string;
  userId: string;
}

export default function AdIntelDashboard({ projectId, userId }: AdIntelDashboardProps) {
  const [competitors, setCompetitors] = useState<CompetitorProfile[]>([]);
  const [selectedCompetitor, setSelectedCompetitor] = useState<CompetitorProfile | null>(null);
  
  const [report, setReport] = useState<AdIntelReport | null>(null);
  const [ads, setAds] = useState<CompetitorAd[]>([]);
  
  const [isInputOpen, setIsInputOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingReport, setLoadingReport] = useState(false);

  // Load Tracked Competitors
  const fetchCompetitors = async (selectId?: string) => {
    try {
      const res = await fetch(`/api/ad-intel/competitors?projectId=${projectId}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.competitors)) {
        setCompetitors(data.competitors);
        
        if (data.competitors.length > 0) {
          const defaultSelect = selectId 
            ? data.competitors.find((c: any) => c.id === selectId) || data.competitors[0]
            : data.competitors[0];
          setSelectedCompetitor(defaultSelect);
        } else {
          setSelectedCompetitor(null);
          setReport(null);
          setAds([]);
        }
      }
    } catch (err) {
      console.error('Failed to load competitors:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCompetitors();
  }, [projectId]);

  // Load Report & Ads when selected competitor changes
  useEffect(() => {
    if (!selectedCompetitor) return;

    const loadReportDetails = async () => {
      setLoadingReport(true);
      try {
        const res = await fetch(`/api/ad-intel/report?competitorId=${selectedCompetitor.id}`);
        const data = await res.json();
        if (data.success) {
          setReport(data.report || null);
          setAds(data.ads || []);
        }
      } catch (err) {
        console.error('Failed to load report details:', err);
      } finally {
        setLoadingReport(false);
      }
    };

    loadReportDetails();
  }, [selectedCompetitor]);

  const handleScrapeSuccess = (newReportId: string, competitorId: string) => {
    // Reload competitors list, selecting the newest crawled item
    fetchCompetitors();
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-screen bg-canvas font-dmsans">
        <RefreshCw className="w-6 h-6 text-[#cc785c] animate-spin" />
        <span className="text-xs text-muted-soft mt-2.5">Syncing Ad Intelligence Database...</span>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col lg:flex-row h-screen bg-canvas overflow-hidden font-dmsans select-none">
      
      {/* 1. Tracked Competitors List Sidebar */}
      <div className="w-full lg:w-64 border-b lg:border-b-0 lg:border-r border-hairline bg-surface-soft/45 flex flex-col shrink-0">
        
        {/* Sidebar Header */}
        <div className="p-4 border-b border-hairline flex items-center justify-between">
          <span className="text-xs font-bold text-ink uppercase tracking-wider">Tracked Brands</span>
          <button
            onClick={() => setIsInputOpen(true)}
            className="p-1 hover:bg-surface-cream-strong rounded text-[#cc785c] hover:text-[#a9583e] transition-colors cursor-pointer"
            title="Track Competitor"
          >
            <Plus className="w-4.5 h-4.5" />
          </button>
        </div>

        {/* Competitor Items Container */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {competitors.map((c) => {
            const isSelected = selectedCompetitor?.id === c.id;
            return (
              <button
                key={c.id}
                onClick={() => setSelectedCompetitor(c)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all text-left cursor-pointer ${
                  isSelected
                    ? 'bg-surface-cream-strong text-ink border-l-3 border-[#cc785c]'
                    : 'hover:bg-surface-soft text-muted hover:text-ink'
                }`}
              >
                <Globe className={`w-4 h-4 ${isSelected ? 'text-[#cc785c]' : 'text-muted-soft'}`} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-ink">{c.competitor_name}</div>
                  <div className="text-[10px] text-muted-soft truncate mt-0.5">{c.competitor_domain}</div>
                </div>
              </button>
            );
          })}

          {competitors.length === 0 && (
            <div className="text-center py-8 px-4 text-xs text-muted-soft italic leading-normal">
              No competitors tracked. Paste a competitor URL to start.
            </div>
          )}
        </div>
      </div>

      {/* 2. Main Dashboard Content Workspace */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        
        {/* Top Header Controls bar */}
        {selectedCompetitor ? (
          <div className="p-4 border-b border-hairline bg-canvas flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0 text-left">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-serif text-lg font-normal text-ink">
                  {selectedCompetitor.competitor_name}
                </h2>
                <span className="text-[10px] text-muted bg-surface-soft border border-hairline px-2 py-0.5 rounded-full uppercase tracking-wider">
                  {selectedCompetitor.competitor_domain}
                </span>
              </div>
              
              <div className="text-[10px] text-muted-soft mt-0.5 flex items-center gap-1.5">
                <span>Google Advertiser: {selectedCompetitor.google_ads_id || 'N/A'}</span>
                <span>•</span>
                <span>Meta Page: {selectedCompetitor.meta_page_id || 'N/A'}</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {selectedCompetitor.last_scraped_at && (
                <span className="text-[10px] text-muted-soft">
                  Last crawled: {new Date(selectedCompetitor.last_scraped_at).toLocaleString()}
                </span>
              )}
              <button
                onClick={() => setIsInputOpen(true)}
                className="flex items-center gap-1 px-3 py-1.5 bg-[#cc785c] hover:bg-[#a9583e] text-white rounded-lg text-xs font-semibold cursor-pointer transition-colors shadow-2xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Track Competitor</span>
              </button>
            </div>
          </div>
        ) : null}

        {/* Dashboard Workspace viewport */}
        <div className="flex-1 overflow-y-auto p-6 bg-canvas flex flex-col justify-between">
          <div className="flex-1">
            {selectedCompetitor ? (
              loadingReport ? (
                <div className="flex flex-col items-center justify-center py-24">
                  <RefreshCw className="w-6 h-6 text-[#cc785c] animate-spin" />
                  <span className="text-xs text-muted-soft mt-2.5">Retrieving active campaigns...</span>
                </div>
              ) : report ? (
                <IntelReport 
                  report={report} 
                  ads={ads} 
                  projectId={projectId} 
                  onRefresh={() => setSelectedCompetitor(selectedCompetitor)} 
                />
              ) : (
                <div className="flex flex-col items-center justify-center py-24 border border-dashed border-[#E5E0DA] bg-surface-soft/10 rounded-2xl max-w-lg mx-auto text-center p-6 space-y-4">
                  <AlertCircle className="w-8 h-8 text-[#cc785c]" />
                  <div className="space-y-1.5">
                    <h4 className="text-sm font-bold text-ink">Analyzing ad datasets...</h4>
                    <p className="text-xs text-muted-soft leading-normal">
                      The competitor account has been tracked, but analysis metrics have not completed. Click Scrape again to reload pipeline records.
                    </p>
                  </div>
                </div>
              )
            ) : (
              // Premium empty state dashboard callout
              <div className="flex flex-col items-center justify-center py-24 max-w-xl mx-auto text-center space-y-6">
                
                <div className="w-16 h-16 rounded-full bg-[#cc785c]/10 flex items-center justify-center border border-[#cc785c]/20">
                  <Sparkles className="w-8 h-8 text-[#cc785c]" />
                </div>

                <div className="space-y-2">
                  <h2 className="font-serif text-2xl text-ink font-normal">Competitive Ad Intelligence</h2>
                  <p className="text-sm text-body leading-relaxed max-w-md mx-auto">
                    Automatically scrape advertising configurations from Meta Ad Library and Google Transparency logs. Analyze hook variations and write better marketing creative copy.
                  </p>
                </div>

                <button
                  onClick={() => setIsInputOpen(true)}
                  className="px-6 py-2.5 bg-[#cc785c] hover:bg-[#a9583e] text-white rounded-lg text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer scale-105"
                >
                  <Plus className="w-4 h-4" />
                  <span>Track Your First Competitor</span>
                </button>
              </div>
            )}
          </div>

          <div className="mt-8 border-t border-hairline pt-6 shrink-0">
            <h3 className="text-xs font-bold uppercase tracking-wider text-ink mb-3">Live Ad Crawler Stream</h3>
            <LiveFeed 
              projectId={projectId} 
              filterTypes={[
                StreamEventType.AD_INTEL_SCRAPING,
                StreamEventType.AD_INTEL_ANALYZING,
                StreamEventType.AD_INTEL_GENERATING,
                StreamEventType.AD_FOUND,
                StreamEventType.ADS_COMPLETE
              ]}
              maxHeight="200px"
              compact={true}
            />
          </div>
        </div>
      </div>

      {/* Scraper dialog popup modal */}
      <CompetitorInput 
        isOpen={isInputOpen} 
        onClose={() => setIsInputOpen(false)} 
        projectId={projectId} 
        userId={userId} 
        onSuccess={handleScrapeSuccess} 
      />
    </div>
  );
}
