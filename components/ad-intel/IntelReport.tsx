'use client';

import React, { useState, useEffect } from 'react';
import { AdIntelReport, CompetitorAd, AdVariation, GeneratedCampaign } from '../../types';
import AdPreview from './AdPreview';
import CampaignExport from './CampaignExport';
import { 
  Sparkles, 
  TrendingUp, 
  Target, 
  Layout, 
  Layers, 
  FileText, 
  Calendar, 
  Loader2, 
  ArrowRight,
  Bookmark,
  CheckCircle,
  Copy,
  Check
} from 'lucide-react';

interface IntelReportProps {
  report: AdIntelReport;
  ads: CompetitorAd[];
  projectId: string;
  onRefresh: () => void;
}

export default function IntelReport({ report, ads, projectId, onRefresh }: IntelReportProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'meta' | 'google' | 'variations' | 'strategy' | 'landing'>('overview');
  const [generating, setGenerating] = useState<string | null>(null);
  
  // Variations & Campaign States
  const [metaCampaign, setMetaCampaign] = useState<GeneratedCampaign | null>(null);
  const [googleCampaign, setGoogleCampaign] = useState<GeneratedCampaign | null>(null);
  const [landingPageCopy, setLandingPageCopy] = useState<string | null>(null);
  const [copiedText, setCopiedText] = useState<string | null>(null);

  // Load existing campaigns
  useEffect(() => {
    fetch(`/api/ad-intel/campaigns?projectId=${projectId}`)
      .then(res => res.json())
      .then(data => {
        if (data.success && Array.isArray(data.campaigns)) {
          // Find campaigns associated with this report/competitor
          const thisCompCampaigns = data.campaigns.filter((c: any) => c.competitor_id === report.competitor_id);
          
          const metaCamp = thisCompCampaigns.find((c: any) => c.platform === 'meta');
          const googleCamp = thisCompCampaigns.find((c: any) => c.platform === 'google');
          
          if (metaCamp) setMetaCampaign(metaCamp);
          if (googleCamp) setGoogleCampaign(googleCamp);
        }
      })
      .catch(err => console.warn('Failed to load campaigns:', err));
  }, [report, projectId]);

  const generateVariations = async (platform: 'meta' | 'google') => {
    setGenerating(platform);
    try {
      const res = await fetch('/api/ad-intel/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reportId: report.id,
          platform,
          projectId,
          count: 4
        })
      });
      const data = await res.json();
      if (data.success) {
        // Reload campaigns
        const campRes = await fetch(`/api/ad-intel/campaigns?projectId=${projectId}`);
        const campData = await campRes.json();
        if (campData.success && Array.isArray(campData.campaigns)) {
          const matching = campData.campaigns.filter((c: any) => c.competitor_id === report.competitor_id);
          const metaCamp = matching.find((c: any) => c.platform === 'meta');
          const googleCamp = matching.find((c: any) => c.platform === 'google');
          if (metaCamp) setMetaCampaign(metaCamp);
          if (googleCamp) setGoogleCampaign(googleCamp);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setGenerating(null);
    }
  };

  const generateStrategy = async () => {
    setGenerating('strategy');
    try {
      const res = await fetch('/api/ad-intel/strategy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reportId: report.id,
          projectId
        })
      });
      const data = await res.json();
      if (data.success) {
        if (metaCampaign) {
          setMetaCampaign({ ...metaCampaign, strategy: data.strategy });
        } else if (googleCampaign) {
          setGoogleCampaign({ ...googleCampaign, strategy: data.strategy });
        }
        setActiveTab('strategy');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setGenerating(null);
    }
  };

  const generateLandingPage = async () => {
    setGenerating('landing');
    try {
      const res = await fetch('/api/ad-intel/landing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reportId: report.id,
          projectId
        })
      });
      const data = await res.json();
      if (data.success) {
        setLandingPageCopy(data.landingPageCopy);
        setActiveTab('landing');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setGenerating(null);
    }
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(id);
    setTimeout(() => setCopiedText(null), 2000);
  };

  const metaAds = ads.filter(ad => ad.platform === 'meta');
  const googleAds = ads.filter(ad => ad.platform === 'google');

  // Simple Markdown Renderer
  const renderMarkdown = (text: string | null) => {
    if (!text) return <p className="text-xs text-muted-soft italic">No content generated yet.</p>;

    const lines = text.split('\n');
    return (
      <div className="space-y-4 text-left font-sans text-sm text-body leading-relaxed">
        {lines.map((line, idx) => {
          if (line.startsWith('# ')) {
            return <h1 key={idx} className="font-serif text-2xl text-ink font-normal border-b border-hairline pb-2 mt-6 mb-3">{line.substring(2)}</h1>;
          }
          if (line.startsWith('## ')) {
            return <h2 key={idx} className="font-serif text-lg text-ink font-medium mt-5 mb-2.5 flex items-center gap-2">{line.substring(3)}</h2>;
          }
          if (line.startsWith('### ')) {
            return <h3 key={idx} className="font-serif text-base text-ink font-semibold mt-4 mb-2">{line.substring(4)}</h3>;
          }
          if (line.startsWith('- ') || line.startsWith('* ')) {
            return (
              <ul key={idx} className="list-disc pl-5 space-y-1.5 text-body">
                <li>{line.substring(2)}</li>
              </ul>
            );
          }
          if (line.trim() === '') return <div key={idx} className="h-2" />;
          return <p key={idx} className="mb-3">{line}</p>;
        })}
      </div>
    );
  };

  // Compute angle frequencies for bar chart
  const anglesList = (report.top_angles as any[]) || [];
  const maxFreq = anglesList.reduce((max, curr) => curr.frequency > max ? curr.frequency : max, 1);

  return (
    <div className="space-y-6">
      {/* Tab bar header */}
      <div className="flex border-b border-hairline overflow-x-auto no-scrollbar scroll-smooth gap-1">
        {[
          { id: 'overview', label: 'Strategy Overview', icon: <TrendingUp className="w-4 h-4" /> },
          { id: 'meta', label: `Meta Ads (${metaAds.length})`, icon: <Layers className="w-4 h-4" /> },
          { id: 'google', label: `Google Ads (${googleAds.length})`, icon: <Layout className="w-4 h-4" /> },
          { id: 'variations', label: 'Custom Campaigns', icon: <Sparkles className="w-4 h-4" /> },
          { id: 'strategy', label: '30-Day Plan', icon: <Calendar className="w-4 h-4" /> },
          { id: 'landing', label: 'Landing Page Copy', icon: <FileText className="w-4 h-4" /> }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-1.5 px-4 py-3 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
              activeTab === tab.id
                ? 'border-[#cc785c] text-[#cc785c] bg-surface-soft/40'
                : 'border-transparent text-muted hover:text-ink hover:bg-surface-soft/20'
            }`}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab Panels */}
      <div className="min-h-[400px]">
        {/* 1. OVERVIEW */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-[#FFFFFF] border border-[#E5E0DA] rounded-xl p-4 text-left">
                <div className="text-[11px] font-bold text-muted uppercase tracking-wider">Total Ads Scraped</div>
                <div className="text-3xl font-serif text-ink mt-1.5">{report.total_ads_found}</div>
                <div className="text-[10px] text-muted-soft mt-1">Found on Meta & Google Ads</div>
              </div>
              <div className="bg-[#FFFFFF] border border-[#E5E0DA] rounded-xl p-4 text-left">
                <div className="text-[11px] font-bold text-muted uppercase tracking-wider">Active Ads Running</div>
                <div className="text-3xl font-serif text-ink mt-1.5">{report.active_ads}</div>
                <div className="text-[10px] text-muted-soft mt-1">Actively delivering creatives</div>
              </div>
              <div className="bg-[#FFFFFF] border border-[#E5E0DA] rounded-xl p-4 text-left">
                <div className="text-[11px] font-bold text-muted uppercase tracking-wider">Primary Hook Angle</div>
                <div className="text-lg font-bold text-ink mt-3 truncate uppercase tracking-wide text-[#cc785c]">
                  {anglesList[0]?.angle || 'Product Utility'}
                </div>
                <div className="text-[10px] text-muted-soft mt-1">Highest frequency competitor hook</div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-4">
              {/* Top Marketing Angles (Custom Horizontal Bar Chart) */}
              <div className="bg-[#FFFFFF] border border-[#E5E0DA] rounded-xl p-5 text-left">
                <h3 className="font-serif text-base text-ink font-semibold mb-4 flex items-center gap-1.5">
                  <Target className="w-4 h-4 text-[#cc785c]" />
                  <span>Top Marketing Angles</span>
                </h3>
                
                <div className="space-y-4">
                  {anglesList.map((a, idx) => {
                    const widthPercent = Math.max(15, Math.round((a.frequency / maxFreq) * 100));
                    return (
                      <div key={idx} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-ink">{a.angle}</span>
                          <span className="text-muted-soft font-mono">{a.frequency} occurrences</span>
                        </div>
                        <div className="w-full h-3.5 bg-surface-soft rounded-full overflow-hidden flex">
                          <div 
                            style={{ width: `${widthPercent}%` }} 
                            className="bg-[#cc785c]/80 hover:bg-[#cc785c] rounded-full transition-all duration-300"
                          />
                        </div>
                        <div className="text-[10px] text-muted-soft italic pl-1 leading-normal">
                          Example: &ldquo;{a.example}&rdquo;
                        </div>
                      </div>
                    );
                  })}
                  {anglesList.length === 0 && (
                    <p className="text-xs text-muted-soft italic">No marketing angles computed.</p>
                  )}
                </div>
              </div>

              {/* AI Strategic Insights */}
              <div className="bg-[#FFFFFF] border border-[#E5E0DA] rounded-xl p-5 text-left">
                <h3 className="font-serif text-base text-ink font-semibold mb-4 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-[#cc785c]" />
                  <span>Growth Intelligence Insights</span>
                </h3>
                <div className="prose max-h-[350px] overflow-y-auto pr-2 scrollbar-thin">
                  {renderMarkdown(report.insights)}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 2. META ADS */}
        {activeTab === 'meta' && (
          <div className="space-y-4">
            {metaAds.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {metaAds.map((ad) => (
                  <AdPreview key={ad.id} ad={ad} />
                ))}
              </div>
            ) : (
              <div className="text-center py-12 bg-[#FFFFFF] border border-[#E5E0DA] rounded-xl">
                <p className="text-sm text-muted">No Meta Ads found for this competitor.</p>
              </div>
            )}
          </div>
        )}

        {/* 3. GOOGLE ADS */}
        {activeTab === 'google' && (
          <div className="space-y-4">
            {googleAds.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {googleAds.map((ad) => (
                  <AdPreview key={ad.id} ad={ad} />
                ))}
              </div>
            ) : (
              <div className="text-center py-12 bg-[#FFFFFF] border border-[#E5E0DA] rounded-xl">
                <p className="text-sm text-muted">No Google Ads found for this competitor.</p>
              </div>
            )}
          </div>
        )}

        {/* 4. CUSTOM CAMPAIGNS */}
        {activeTab === 'variations' && (
          <div className="space-y-6">
            {/* Meta Ad Campaigns Generation block */}
            <div className="bg-[#FFFFFF] border border-[#E5E0DA] rounded-xl p-5 text-left space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#F0EBE5] pb-3.5">
                <div>
                  <h3 className="font-serif text-base text-ink font-semibold flex items-center gap-1.5">
                    <Layers className="w-4.5 h-4.5 text-[#cc785c]" />
                    <span>Meta Feed Ad Variations</span>
                  </h3>
                  <p className="text-[10px] text-muted-soft mt-0.5">Custom social copy optimized for CTR inspired by competitor hooks.</p>
                </div>
                {metaCampaign && (
                  <CampaignExport 
                    variations={metaCampaign.ad_variations as AdVariation[]} 
                    platform="meta" 
                    campaignName={metaCampaign.campaign_name}
                  />
                )}
              </div>

              {metaCampaign ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {(metaCampaign.ad_variations as AdVariation[]).map((v) => (
                    <div key={v.variation_number} className="bg-surface-soft/30 border border-[#E5E0DA] rounded-lg p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-[#cc785c] uppercase bg-[#cc785c]/10 px-2 py-0.5 rounded-full">
                          Angle: {v.angle}
                        </span>
                        <button
                          onClick={() => handleCopy(`Headline: ${v.headline}\nBody: ${v.body}\nCTA: ${v.cta}`, `meta_${v.variation_number}`)}
                          className="p-1 hover:bg-surface-cream-strong rounded text-muted hover:text-ink transition-colors cursor-pointer"
                          title="Copy Copy"
                        >
                          {copiedText === `meta_${v.variation_number}` ? (
                            <Check className="w-3.5 h-3.5 text-green-600" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                      <div className="space-y-1">
                        <div className="text-[11px] font-bold text-muted uppercase">Headline</div>
                        <div className="text-xs font-bold text-ink leading-snug">{v.headline}</div>
                      </div>
                      <div className="space-y-1">
                        <div className="text-[11px] font-bold text-muted uppercase">Body Text</div>
                        <div className="text-xs text-body leading-relaxed">{v.body}</div>
                      </div>
                      <div className="pt-2 border-t border-[#E5E0DA] text-[10px] text-muted-soft leading-normal space-y-1">
                        <div><strong className="text-ink">CTA Button:</strong> {v.cta}</div>
                        <div><strong className="text-ink">Why it works:</strong> {v.why_this_works}</div>
                        <div><strong className="text-[#cc785c]">Inspiration:</strong> {v.inspired_by}</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6">
                  <button
                    disabled={generating === 'meta'}
                    onClick={() => generateVariations('meta')}
                    className="px-4 py-2 bg-[#cc785c] hover:bg-[#a9583e] text-white rounded-lg text-xs font-bold transition-colors cursor-pointer disabled:opacity-50 inline-flex items-center gap-1.5"
                  >
                    {generating === 'meta' ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Generating copy...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Generate Meta Ad Copy Variations</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>

            {/* Google Search Campaigns Generation block */}
            <div className="bg-[#FFFFFF] border border-[#E5E0DA] rounded-xl p-5 text-left space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#F0EBE5] pb-3.5">
                <div>
                  <h3 className="font-serif text-base text-ink font-semibold flex items-center gap-1.5">
                    <Layout className="w-4.5 h-4.5 text-[#cc785c]" />
                    <span>Google Search Ad Variations</span>
                  </h3>
                  <p className="text-[10px] text-muted-soft mt-0.5">High-converting search headlines and description lines.</p>
                </div>
                {googleCampaign && (
                  <CampaignExport 
                    variations={googleCampaign.ad_variations as AdVariation[]} 
                    platform="google" 
                    campaignName={googleCampaign.campaign_name}
                  />
                )}
              </div>

              {googleCampaign ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {(googleCampaign.ad_variations as AdVariation[]).map((v) => (
                    <div key={v.variation_number} className="bg-surface-soft/30 border border-[#E5E0DA] rounded-lg p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-[#cc785c] uppercase bg-[#cc785c]/10 px-2 py-0.5 rounded-full">
                          Angle: {v.angle}
                        </span>
                        <button
                          onClick={() => handleCopy(`Headline: ${v.headline}\nBody: ${v.body}\nCTA: ${v.cta}`, `google_${v.variation_number}`)}
                          className="p-1 hover:bg-surface-cream-strong rounded text-muted hover:text-ink transition-colors cursor-pointer"
                          title="Copy Copy"
                        >
                          {copiedText === `google_${v.variation_number}` ? (
                            <Check className="w-3.5 h-3.5 text-green-600" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                      <div className="space-y-1">
                        <div className="text-[11px] font-bold text-muted uppercase">Search Headline</div>
                        <div className="text-xs font-bold text-[#1a0dab] font-serif leading-snug">{v.headline}</div>
                      </div>
                      <div className="space-y-1">
                        <div className="text-[11px] font-bold text-muted uppercase">Description Line</div>
                        <div className="text-xs text-[#4d5156] leading-relaxed">{v.body}</div>
                      </div>
                      <div className="pt-2 border-t border-[#E5E0DA] text-[10px] text-muted-soft leading-normal space-y-1">
                        <div><strong className="text-ink">Why it works:</strong> {v.why_this_works}</div>
                        <div><strong className="text-[#cc785c]">Inspiration:</strong> {v.inspired_by}</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6">
                  <button
                    disabled={generating === 'google'}
                    onClick={() => generateVariations('google')}
                    className="px-4 py-2 bg-[#cc785c] hover:bg-[#a9583e] text-white rounded-lg text-xs font-bold transition-colors cursor-pointer disabled:opacity-50 inline-flex items-center gap-1.5"
                  >
                    {generating === 'google' ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Generating copy...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Generate Google Search Variations</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>

            {/* Strategy & Landing page shortcuts */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-[#FFFFFF] border border-[#E5E0DA] rounded-xl p-5 text-left flex items-start gap-4">
                <Calendar className="w-10 h-10 text-[#cc785c] shrink-0 bg-surface-soft p-2 rounded-lg" />
                <div className="space-y-2">
                  <h4 className="text-sm font-serif font-bold text-ink">30-Day Launch Blueprint</h4>
                  <p className="text-[11px] text-muted-soft leading-normal">
                    Develop a weekly plan for budget allocation, audience definitions, and channel split schedules.
                  </p>
                  <button
                    disabled={generating !== null}
                    onClick={generateStrategy}
                    className="text-xs text-[#cc785c] hover:text-[#a9583e] font-bold flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    {generating === 'strategy' ? (
                      <>
                        <Loader2 className="w-3 h-3 animate-spin" />
                        <span>Planning Strategy...</span>
                      </>
                    ) : (
                      <>
                        <span>Formulate Strategy</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div className="bg-[#FFFFFF] border border-[#E5E0DA] rounded-xl p-5 text-left flex items-start gap-4">
                <FileText className="w-10 h-10 text-[#cc785c] shrink-0 bg-surface-soft p-2 rounded-lg" />
                <div className="space-y-2">
                  <h4 className="text-sm font-serif font-bold text-ink">Landing Page Blueprint</h4>
                  <p className="text-[11px] text-muted-soft leading-normal">
                    Generate structured conversion landing copy (above the fold, benefit pillars, objection FAQs) that beats competitor URLs.
                  </p>
                  <button
                    disabled={generating !== null}
                    onClick={generateLandingPage}
                    className="text-xs text-[#cc785c] hover:text-[#a9583e] font-bold flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    {generating === 'landing' ? (
                      <>
                        <Loader2 className="w-3 h-3 animate-spin" />
                        <span>Formulating page...</span>
                      </>
                    ) : (
                      <>
                        <span>Formulate Landing Copy</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 5. ROLLOUT STRATEGY */}
        {activeTab === 'strategy' && (
          <div className="bg-[#FFFFFF] border border-[#E5E0DA] rounded-xl p-6 text-left">
            <div className="flex items-center justify-between border-b border-[#F0EBE5] pb-3 mb-5">
              <h3 className="font-serif text-base text-ink font-semibold flex items-center gap-1.5">
                <Calendar className="w-4.5 h-4.5 text-[#cc785c]" />
                <span>30-Day Campaign Blueprint Plan</span>
              </h3>
              {(metaCampaign?.strategy || googleCampaign?.strategy) && (
                <button
                  onClick={() => handleCopy(metaCampaign?.strategy || googleCampaign?.strategy || '', 'strat_copy')}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-canvas border border-hairline hover:bg-surface-soft text-ink rounded-lg text-xs font-semibold cursor-pointer transition-colors"
                >
                  {copiedText === 'strat_copy' ? (
                    <CheckCircle className="w-3.5 h-3.5 text-green-600" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  <span>{copiedText === 'strat_copy' ? 'Copied Strategy' : 'Copy Strategy'}</span>
                </button>
              )}
            </div>
            {metaCampaign?.strategy || googleCampaign?.strategy ? (
              renderMarkdown(metaCampaign?.strategy || googleCampaign?.strategy || null)
            ) : (
              <div className="text-center py-12">
                <p className="text-xs text-muted mb-4">No launch plan strategy generated yet.</p>
                <button
                  disabled={generating !== null}
                  onClick={generateStrategy}
                  className="px-4 py-2 bg-[#cc785c] hover:bg-[#a9583e] text-white rounded-lg text-xs font-bold cursor-pointer disabled:opacity-50"
                >
                  {generating === 'strategy' ? (
                    <span className="flex items-center gap-1">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      <span>Formulating plan...</span>
                    </span>
                  ) : (
                    <span>Formulate 30-Day Campaign Strategy</span>
                  )}
                </button>
              </div>
            )}
          </div>
        )}

        {/* 6. LANDING PAGE COPY */}
        {activeTab === 'landing' && (
          <div className="bg-[#FFFFFF] border border-[#E5E0DA] rounded-xl p-6 text-left">
            <div className="flex items-center justify-between border-b border-[#F0EBE5] pb-3 mb-5">
              <h3 className="font-serif text-base text-ink font-semibold flex items-center gap-1.5">
                <FileText className="w-4.5 h-4.5 text-[#cc785c]" />
                <span>Landing Page Copy & Layout proposal</span>
              </h3>
              {landingPageCopy && (
                <button
                  onClick={() => handleCopy(landingPageCopy, 'land_copy')}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-canvas border border-hairline hover:bg-surface-soft text-ink rounded-lg text-xs font-semibold cursor-pointer transition-colors"
                >
                  {copiedText === 'land_copy' ? (
                    <CheckCircle className="w-3.5 h-3.5 text-green-600" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  <span>{copiedText === 'land_copy' ? 'Copied Proposal' : 'Copy Proposal'}</span>
                </button>
              )}
            </div>
            {landingPageCopy ? (
              renderMarkdown(landingPageCopy)
            ) : (
              <div className="text-center py-12">
                <p className="text-xs text-muted mb-4">No landing page copy generated yet.</p>
                <button
                  disabled={generating !== null}
                  onClick={generateLandingPage}
                  className="px-4 py-2 bg-[#cc785c] hover:bg-[#a9583e] text-white rounded-lg text-xs font-bold cursor-pointer disabled:opacity-50"
                >
                  {generating === 'landing' ? (
                    <span className="flex items-center gap-1">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      <span>Formulating Copy...</span>
                    </span>
                  ) : (
                    <span>Formulate Landing Page copy Proposal</span>
                  )}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
