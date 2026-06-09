'use client';

import React, { useState } from 'react';
import { Download, Globe, Award, ShieldAlert, BadgeInfo, FileText, CheckCircle2 } from 'lucide-react';

interface DDSection {
  id: string;
  section_type: 'market_size' | 'competitors' | 'founder_background' | 'product' | 'financials' | 'red_flags' | 'investment_thesis' | 'summary';
  title: string;
  content: string;
  score: number;
  sources: string[];
  data: Record<string, any>;
}

interface DDReportDetails {
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

interface DDReportProps {
  report: DDReportDetails;
  sections: DDSection[];
  onRefresh?: () => void;
}

export default function DDReport({ report, sections, onRefresh }: DDReportProps) {
  const [activeSection, setActiveSection] = useState<string>('summary');

  // Sort sections based on logical flow
  const orderMap: Record<string, number> = {
    summary: 0,
    investment_thesis: 1,
    market_size: 2,
    competitors: 3,
    founder_background: 4,
    product: 5,
    financials: 6,
    red_flags: 7
  };

  const sortedSections = [...sections].sort((a, b) => {
    const orderA = orderMap[a.section_type] !== undefined ? orderMap[a.section_type] : 99;
    const orderB = orderMap[b.section_type] !== undefined ? orderMap[b.section_type] : 99;
    return orderA - orderB;
  });

  const activeSecData = sortedSections.find((s) => s.section_type === activeSection) || sortedSections[0];

  // Map section types to readable titles, colors, and descriptions
  const sectionMeta: Record<string, { label: string; desc: string; color: string }> = {
    summary: { label: 'Executive Summary', desc: 'Brief overview of findings.', color: 'border-[#cc785c] text-[#cc785c]' },
    investment_thesis: { label: 'Investment Thesis', desc: 'Venture Capital recommendation.', color: 'border-[#a9583e] text-[#a9583e]' },
    market_size: { label: 'Market TAM/SAM', desc: 'Total addressable market limits.', color: 'border-blue-500 text-blue-600' },
    competitors: { label: 'Competitive Landscape', desc: 'Core market rival threat level.', color: 'border-indigo-500 text-indigo-600' },
    founder_background: { label: 'Founder Background', desc: 'Education & track record.', color: 'border-[#e8a55a] text-[#e8a55a]' },
    product: { label: 'Product deep-dive', desc: 'Core feature and review signals.', color: 'border-[#5db8a6] text-[#5db8a6]' },
    financials: { label: 'Financial Signals', desc: 'Crunchbase funding re-evaluation.', color: 'border-green-500 text-green-600' },
    red_flags: { label: 'Risk Assessment', desc: 'Controversies and legal flags.', color: 'border-red-500 text-red-600' }
  };

  return (
    <div className="flex flex-col lg:flex-row h-full overflow-hidden text-left font-dmsans">
      {/* 1. Score Summary Sidebar (Left) */}
      <div className="w-full lg:w-72 border-b lg:border-b-0 lg:border-r border-hairline bg-surface-soft/45 flex flex-col shrink-0 overflow-y-auto">
        {/* Core KPI metrics */}
        <div className="p-6 border-b border-hairline flex flex-col items-center text-center space-y-4">
          <div className="w-20 h-20 rounded-full border-4 border-[#cc785c] flex items-center justify-center font-lora text-3xl font-bold text-[#cc785c] bg-white shadow-sm">
            {report.report_data?.overall_score || 70}
          </div>
          <div>
            <h3 className="font-serif text-lg font-normal text-ink leading-tight">
              {report.target_name}
            </h3>
            <span className="text-[10px] text-muted-soft bg-white border border-hairline px-2 py-0.5 rounded-full uppercase tracking-wider mt-1.5 inline-block">
              {report.target_domain}
            </span>
          </div>

          <div className="w-full pt-4 border-t border-hairline flex flex-col items-center">
            <span className="text-[9px] font-extrabold text-muted uppercase tracking-wider">Recommendation</span>
            <span className="text-xs font-bold text-[#cc785c] bg-[#cc785c]/10 border border-[#cc785c]/20 px-3 py-1 rounded-full mt-1.5 uppercase tracking-wide">
              {report.report_data?.recommendation || 'Neutral'}
            </span>
          </div>
        </div>

        {/* Sections Score List Navigation */}
        <div className="flex-1 p-3 space-y-1">
          <div className="text-[10px] font-bold text-muted-soft uppercase tracking-wider px-3 mb-2">Report Sections</div>
          {sortedSections.map((s) => {
            const isSelected = activeSection === s.section_type;
            const meta = sectionMeta[s.section_type] || { label: s.title, desc: '', color: 'border-muted text-muted' };
            
            return (
              <button
                key={s.id}
                onClick={() => setActiveSection(s.section_type)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-left transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-surface-cream-strong border-l-3 border-[#cc785c] text-ink'
                    : 'hover:bg-surface-soft text-muted hover:text-ink'
                }`}
              >
                <div className="min-w-0 flex-1 pr-2">
                  <div className="text-xs font-semibold truncate text-ink">{meta.label}</div>
                  <div className="text-[9px] text-muted-soft truncate mt-0.5">{meta.desc}</div>
                </div>

                {s.section_type !== 'summary' && s.section_type !== 'investment_thesis' && (
                  <span className={`text-[10px] font-mono font-bold bg-white border px-1.5 py-0.5 rounded ${
                    s.score >= 80 ? 'text-green-600 border-green-200' : s.score >= 60 ? 'text-amber-600 border-amber-200' : 'text-red-600 border-red-200'
                  }`}>
                    {s.score}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Full Section Details Workspace (Right) */}
      <div className="flex-1 flex flex-col h-full overflow-hidden bg-canvas">
        {/* Content Top Controls header */}
        <div className="p-4 border-b border-hairline flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-muted uppercase tracking-wider">Active Section:</span>
            <span className="text-xs font-bold text-ink uppercase tracking-wide bg-surface-soft px-3 py-1 rounded-full border border-hairline">
              {sectionMeta[activeSection]?.label || activeSecData?.title}
            </span>
          </div>

          {report.pdf_url && (
            <a
              href={report.pdf_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-4.5 py-1.5 bg-[#cc785c] hover:bg-[#a9583e] text-white rounded-xl text-xs font-bold shadow-2xs cursor-pointer transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download A4 Brief</span>
            </a>
          )}
        </div>

        {/* Section Viewport Container */}
        {activeSecData ? (
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            <div className="max-w-2xl bg-white border border-[#E5E0DA] rounded-2xl p-6 shadow-3xs">
              <h2 className="font-serif text-2xl font-normal text-ink mb-4 pb-3 border-b border-hairline">
                {activeSecData.title}
              </h2>

              {/* Render Section Score Metric in details */}
              {activeSecData.section_type !== 'summary' && activeSecData.section_type !== 'investment_thesis' && (
                <div className="flex items-center gap-2 mb-6 bg-surface-soft/60 border border-hairline/60 rounded-xl p-3.5">
                  <Award className="w-5 h-5 text-[#cc785c]" />
                  <div>
                    <div className="text-[10px] font-extrabold uppercase tracking-wider text-muted-soft">Diligence Rating Score</div>
                    <div className="text-sm font-bold text-ink flex items-baseline gap-1 mt-0.5">
                      <span>{activeSecData.score} / 100</span>
                      <span className="text-[10px] text-muted-soft font-normal">(VC benchmarks require &gt;75)</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Section Main Content Markup */}
              <div 
                className="prose prose-sm text-xs text-body leading-relaxed whitespace-pre-wrap font-dmsans max-w-none"
                dangerouslySetInnerHTML={{ 
                  __html: activeSecData.content
                    .replace(/### (.*)/g, '<h3 class="font-serif text-md font-bold text-ink mt-6 mb-2">$1</h3>')
                    .replace(/## (.*)/g, '<h2 class="font-serif text-lg font-bold text-ink mt-8 mb-3 border-b border-hairline pb-1">$1</h2>')
                    .replace(/# (.*)/g, '<h1 class="font-serif text-xl font-bold text-ink mt-8 mb-4">$1</h1>')
                    .replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-ink">$1</strong>')
                    .replace(/\*(.*?)\*/g, '<em class="italic">$1</em>')
                    .replace(/- (.*)/g, '<li class="ml-4 list-disc mt-1">$1</li>')
                }}
              />
            </div>

            {/* Render sources card if present */}
            {Array.isArray(activeSecData.sources) && activeSecData.sources.length > 0 && (
              <div className="max-w-2xl bg-surface-soft/30 border border-hairline rounded-2xl p-5">
                <div className="flex items-center gap-1.5 text-[10px] font-bold text-ink uppercase tracking-wider mb-3">
                  <Globe className="w-4 h-4 text-muted-soft" />
                  <span>Verified Agent Sources ({activeSecData.sources.length})</span>
                </div>
                <ul className="space-y-1.5 text-[10px] text-muted-soft">
                  {activeSecData.sources.map((src, idx) => (
                    <li key={idx} className="truncate hover:text-[#cc785c] transition-colors">
                      <a href={src} target="_blank" rel="noopener noreferrer" className="hover:underline flex items-center gap-1">
                        <span>•</span>
                        <span>{src}</span>
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center h-full">
            <span className="text-xs text-muted-soft italic">No data gathered for this section.</span>
          </div>
        )}
      </div>
    </div>
  );
}
