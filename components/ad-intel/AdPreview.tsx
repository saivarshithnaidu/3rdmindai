'use client';

import React from 'react';
import { CompetitorAd } from '../../types';
import { ExternalLink, Globe, Sparkles } from 'lucide-react';

interface AdPreviewProps {
  ad: CompetitorAd;
}

export default function AdPreview({ ad }: AdPreviewProps) {
  const isGoogle = ad.platform === 'google';

  if (isGoogle) {
    // Google Search Ad Preview
    return (
      <div className="w-full bg-[#FFFFFF] border border-[#E5E0DA] rounded-xl p-4 shadow-2xs hover:shadow-xs transition-shadow duration-200 font-sans text-left">
        {/* Ad Indicator and Breadcrumb */}
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-2 text-xs text-[#202124]">
            <span className="font-bold border border-[#202124] rounded-xs px-1 py-0.5 text-[9px] uppercase tracking-wider scale-90 origin-left">
              Sponsored
            </span>
            <span className="text-muted-soft truncate max-w-[200px]">
              {ad.landing_url || 'https://google.com'}
            </span>
          </div>
          <span className="text-[10px] text-muted-soft">Google Search</span>
        </div>

        {/* Headline */}
        <a 
          href={ad.landing_url || '#'} 
          target="_blank" 
          rel="noopener noreferrer"
          className="block text-lg font-medium text-[#1a0dab] hover:underline leading-snug mb-1 font-serif"
        >
          {ad.headline || 'Official Website'}
        </a>

        {/* Description */}
        <p className="text-xs text-[#4d5156] leading-relaxed mb-3">
          {ad.body || 'No description provided.'}
        </p>

        {/* Footer Details */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#F0EBE5] pt-2 mt-2 text-[10px] text-muted">
          <div className="flex items-center gap-1.5">
            <Globe className="w-3 h-3 text-muted-soft" />
            <span>Target Link:</span>
            <a 
              href={ad.landing_url || '#'} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-[#cc785c] hover:underline font-medium truncate max-w-[150px] inline-flex items-center gap-0.5"
            >
              <span>{ad.landing_url ? new URL(ad.landing_url).hostname : 'Learn More'}</span>
              <ExternalLink className="w-2 h-2" />
            </a>
          </div>
          {ad.start_date && (
            <span>Running since: {new Date(ad.start_date).toLocaleDateString()}</span>
          )}
        </div>
      </div>
    );
  }

  // Meta Ad Feed Preview
  const displayDays = ad.running_days !== null ? `${ad.running_days} days` : '';

  return (
    <div className="w-full bg-[#FFFFFF] border border-[#E5E0DA] rounded-xl p-4 shadow-2xs hover:shadow-xs transition-shadow duration-200 font-sans text-left">
      {/* Header Info */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-surface-card flex items-center justify-center border border-hairline font-bold text-xs text-[#cc785c] uppercase">
            {ad.cta ? ad.cta.charAt(0) : 'M'}
          </div>
          <div>
            <div className="text-xs font-bold text-ink leading-tight">Sponsored Ad</div>
            <div className="text-[10px] text-muted-soft flex items-center gap-1">
              <span>Meta Platforms</span>
              {ad.start_date && (
                <>
                  <span>•</span>
                  <span>Active since {new Date(ad.start_date).toLocaleDateString()}</span>
                </>
              )}
            </div>
          </div>
        </div>
        {displayDays && (
          <span className="bg-[#5db8a6]/10 text-[#2f7e70] px-2 py-0.5 rounded-full text-[9px] font-bold">
            Live {displayDays}
          </span>
        )}
      </div>

      {/* Primary Ad Text (Body) */}
      <p className="text-xs text-[#3d3d3a] leading-relaxed mb-3 whitespace-pre-wrap">
        {ad.body || 'No ad text copy available.'}
      </p>

      {/* Media Mockup */}
      <div className="relative aspect-video w-full bg-[#F4F0EB] rounded-lg border border-[#E5E0DA] flex flex-col items-center justify-center p-4 overflow-hidden mb-3">
        {ad.image_url ? (
          <img 
            src={ad.image_url} 
            alt="Ad Snapshot" 
            className="absolute inset-0 w-full h-full object-cover opacity-90"
            onError={(e) => {
              // hide image and show mockup if URL fails or is blocked
              (e.currentTarget as HTMLElement).style.display = 'none';
            }}
          />
        ) : null}
        
        {/* Overlay Mockup Content */}
        <div className="relative z-10 text-center flex flex-col items-center gap-1.5 max-w-[80%] bg-canvas/80 backdrop-blur-xs p-3 rounded-lg border border-[#E5E0DA] shadow-xs">
          <Sparkles className="w-5 h-5 text-[#cc785c]" />
          <div className="text-[10px] font-bold text-ink uppercase tracking-wide">Visual Ad Campaign</div>
          <div className="text-[9px] text-muted-soft leading-normal truncate max-w-[200px]">
            {ad.landing_url || 'Active on FB & IG'}
          </div>
        </div>
      </div>

      {/* CTA Box (Simulates Facebook card bottom) */}
      <div className="flex items-center justify-between p-3 bg-surface-soft border border-[#E5E0DA] rounded-lg">
        <div className="min-w-0 pr-2">
          <div className="text-[10px] text-muted-soft uppercase tracking-wider truncate">
            {ad.landing_url ? new URL(ad.landing_url).hostname : 'FACEBOOK.COM'}
          </div>
          <div className="text-xs font-bold text-ink truncate leading-tight mt-0.5">
            {ad.headline || 'Learn more about our solutions'}
          </div>
        </div>
        <button 
          type="button"
          onClick={() => ad.landing_url && window.open(ad.landing_url, '_blank')}
          className="shrink-0 bg-[#E5E0DA] hover:bg-[#DED8CF] active:bg-[#D5CECE] text-ink font-semibold px-3 py-1.5 rounded text-[10px] uppercase tracking-wide cursor-pointer transition-colors"
        >
          {ad.cta || 'Learn More'}
        </button>
      </div>

      {/* Stats Summary */}
      {ad.impressions_max && (
        <div className="mt-3 pt-2.5 border-t border-[#F0EBE5] flex items-center justify-between text-[9px] text-muted-soft">
          <span>Est. Impressions Range:</span>
          <span className="font-bold text-ink bg-surface-soft px-1.5 py-0.5 rounded">
            {ad.impressions_min?.toLocaleString()} - {ad.impressions_max?.toLocaleString()}
          </span>
        </div>
      )}
    </div>
  );
}
