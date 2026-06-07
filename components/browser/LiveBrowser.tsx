import React from 'react';
import { BrowserSession } from '../../types';
import { Globe, Lock, Unlock, Loader2, CheckCircle2, AlertTriangle, Play, HelpCircle } from 'lucide-react';
import { SCRAPER_CONFIGS } from '../../lib/scrapers.registry';

interface LiveBrowserProps {
  session: BrowserSession | null;
}

export default function LiveBrowser({ session }: LiveBrowserProps) {
  if (!session) {
    return (
      <div className="flex-grow flex flex-col items-center justify-center p-8 text-center text-xs text-[#85827D] italic border border-dashed border-[#E5E0DA] rounded-xl bg-white/50 h-full min-h-[400px]">
        <HelpCircle className="w-8 h-8 text-[#85827D]/70 mb-2" />
        <p>No active browser session.</p>
        <p className="mt-1 font-normal text-[10px] max-w-[200px]">
          Use the Browser Agent button or execute an agent task requesting live web data to open a browser.
        </p>
      </div>
    );
  }

  const isHttps = session.current_url?.startsWith('https://');
  const scraperConfig = SCRAPER_CONFIGS.find(c => c.id === session.scraper_type);
  const scraperName = scraperConfig?.name || session.scraper_type;

  // Status mapping
  let statusText = 'Initializing...';
  let statusColor = 'text-[#85827D]';
  let statusBg = 'bg-[#EBE5DC]/50';
  let isRunning = false;

  if (session.status === 'active') {
    isRunning = true;
    if (session.current_url) {
      statusText = session.rows_extracted > 0 ? 'Extracting...' : 'Navigating...';
    } else {
      statusText = 'Opening Browser...';
    }
    statusColor = 'text-blue-700';
    statusBg = 'bg-blue-50 border border-blue-100';
  } else if (session.status === 'completed') {
    statusText = 'Completed';
    statusColor = 'text-emerald-700 font-bold';
    statusBg = 'bg-emerald-50 border border-emerald-100';
  } else if (session.status === 'error') {
    statusText = 'Error';
    statusColor = 'text-red-700 font-bold';
    statusBg = 'bg-red-50 border border-red-100';
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-white animate-fadeIn font-dmsans">
      {/* 1. Address Bar Header */}
      <div className="p-3 border-b border-[#E5E0DA] bg-[#FDFBF7] flex flex-col gap-2 shrink-0">
        <div className="flex items-center gap-2">
          {/* Lock Icon */}
          <div className={`p-1.5 rounded-lg border ${isHttps ? 'bg-emerald-50 border-emerald-100 text-emerald-600' : 'bg-amber-50 border-amber-100 text-amber-600'}`}>
            {isHttps ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
          </div>

          {/* URL Bar */}
          <div className="flex-1 relative flex items-center min-w-0">
            <input
              type="text"
              readOnly
              value={session.current_url || 'about:blank'}
              className="w-full bg-[#F5F2EC] border border-[#E5E0DA] rounded-lg py-1.5 pl-8 pr-3 text-xs text-[#191919] font-mono focus:outline-hidden truncate"
            />
            <Globe className="w-3.5 h-3.5 text-[#85827D] absolute left-3" />
          </div>

          {/* Status Badge */}
          <div className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${statusBg} ${statusColor}`}>
            {isRunning && <Loader2 className="w-3 h-3 animate-spin" />}
            {!isRunning && session.status === 'completed' && <CheckCircle2 className="w-3 h-3" />}
            {!isRunning && session.status === 'error' && <AlertTriangle className="w-3 h-3" />}
            <span>{statusText}</span>
          </div>
        </div>
      </div>

      {/* 2. Interactive / Read-only Iframe */}
      <div className="flex-1 bg-[#1E1E1E] relative border-b border-[#E5E0DA] min-h-[350px]">
        {session.live_view_url ? (
          <iframe
            src={session.live_view_url}
            title="Browserbase Live View"
            className="w-full h-full border-0 absolute inset-0"
            style={{ pointerEvents: 'none' }} // User watches, agent controls
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center text-xs text-[#85827D]">
            <Loader2 className="w-6 h-6 animate-spin text-[#85827D] mb-2" />
            <p>Connecting to Browserbase session...</p>
          </div>
        )}

        {/* Read-Only overlay indicator */}
        <div className="absolute top-3 right-3 bg-[#191919]/85 backdrop-blur-xs text-white text-[9px] font-bold px-2 py-1 rounded-md border border-white/10 pointer-events-none select-none uppercase tracking-wider">
          Live Browser (View Only)
        </div>
      </div>

      {/* 3. Bottom Status Bar */}
      <div className="px-4 py-3 border-t border-[#E5E0DA] bg-[#FDFBF7] flex items-center justify-between shrink-0 text-xs text-[#5E5B56]">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="px-2 py-0.5 bg-[#191919] text-white rounded-md font-bold text-[9px] uppercase tracking-wider shrink-0">
            {scraperName}
          </span>
          <span className="font-semibold text-[#191919] truncate max-w-[150px]" title={session.query}>
            "{session.query}"
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="font-bold text-[#191919]">
            {session.rows_extracted} rows extracted
          </span>
        </div>
      </div>
    </div>
  );
}
