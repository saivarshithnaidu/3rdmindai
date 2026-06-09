'use client';

import React, { useState, useRef, useEffect } from 'react';
import { X, Globe, Search, Loader2, Sparkles, Terminal, ShieldCheck, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface CompetitorInputProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  userId: string;
  onSuccess: (reportId: string, competitorId: string) => void;
}

export default function CompetitorInput({ isOpen, onClose, projectId, userId, onSuccess }: CompetitorInputProps) {
  const [competitorUrl, setCompetitorUrl] = useState('');
  const [logs, setLogs] = useState<string[]>([]);
  const [isCrawling, setIsCrawling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setCompetitorUrl('');
      setLogs([]);
      setError(null);
      setIsCrawling(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!competitorUrl) return;

    setIsCrawling(true);
    setError(null);
    setLogs(['Initializing Ad Intelligence crawler...', 'Resolving competitor hostname...']);

    try {
      const response = await fetch('/api/ad-intel/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          competitorUrl: competitorUrl.trim(),
          projectId,
          userId,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'Crawling failed');
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No readable stream returned');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        
        // Save the last incomplete line back to the buffer
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;

          try {
            const data = JSON.parse(line);
            if (data.type === 'progress') {
              setLogs((prev) => [...prev, data.message]);
            } else if (data.type === 'complete') {
              setLogs((prev) => [...prev, '✓ Report generation complete!']);
              setIsCrawling(false);
              
              // We need to fetch the competitor_id for this report
              const repResponse = await fetch(`/api/ad-intel/report?competitorId=dummy&projectId=${projectId}`);
              const repData = await repResponse.json().catch(() => ({}));
              
              setTimeout(() => {
                onSuccess(data.reportId, '');
                onClose();
              }, 1200);
            } else if (data.type === 'error') {
              setError(data.error);
              setIsCrawling(false);
            }
          } catch (jsonErr) {
            console.warn('Failed to parse stream log:', jsonErr);
          }
        }
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || String(err));
      setIsCrawling(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={isCrawling ? undefined : onClose}
          className="fixed inset-0 bg-[#141413]/30 backdrop-blur-xs"
        />

        {/* Modal Content */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 12 }}
          transition={{ type: 'spring', duration: 0.35 }}
          className="relative w-full max-w-lg bg-canvas border border-hairline rounded-2xl shadow-xl overflow-hidden font-dmsans z-10"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-hairline bg-surface-soft">
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-[#cc785c]" />
              <h3 className="font-lora font-normal text-base text-ink">
                Track Competitor Ads
              </h3>
            </div>
            <button
              onClick={onClose}
              disabled={isCrawling}
              className="p-1 hover:bg-surface-cream-strong rounded-lg text-muted hover:text-ink transition-colors cursor-pointer disabled:opacity-50"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-5 space-y-4">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-xs font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {!isCrawling && logs.length === 0 ? (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-muted uppercase tracking-wider">
                    Competitor Website Domain / URL
                  </label>
                  <div className="relative">
                    <Search className="absolute left-3.5 top-3 w-4 h-4 text-muted-soft" />
                    <input
                      type="text"
                      required
                      value={competitorUrl}
                      onChange={(e) => setCompetitorUrl(e.target.value)}
                      placeholder="e.g. competitor.com"
                      className="w-full bg-canvas border border-hairline focus:border-primary focus:ring-2 focus:ring-primary/15 rounded-lg pl-10 pr-4 py-2.5 text-sm text-ink outline-none transition-all placeholder-[#8e8b82]"
                    />
                  </div>
                  <p className="text-[10px] text-muted-soft leading-normal">
                    Pasting a competitor URL will search Google Ads Transparency Center and Meta Ad Library databases, extract active creative variations, and compile growth insights.
                  </p>
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-hairline">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 text-xs font-semibold text-muted hover:text-ink hover:bg-surface-soft rounded-lg border border-hairline bg-canvas transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-xs font-semibold text-on-primary bg-[#cc785c] hover:bg-[#a9583e] rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 shadow-sm"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Run Ad Scraper</span>
                  </button>
                </div>
              </form>
            ) : (
              // Live Progress Logger Screen
              <div className="space-y-4">
                <div className="flex items-center justify-between text-xs font-bold text-muted">
                  <span className="flex items-center gap-1.5">
                    <Terminal className="w-3.5 h-3.5" />
                    <span>Scraper Log Console</span>
                  </span>
                  {isCrawling && (
                    <span className="flex items-center gap-1 text-[#cc785c]">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      <span>Crawling live data...</span>
                    </span>
                  )}
                </div>

                {/* Console Log Area */}
                <div className="w-full h-48 bg-surface-dark rounded-xl border border-surface-dark-elevated p-4 overflow-y-auto font-mono text-[11px] leading-relaxed text-on-dark-soft space-y-1.5">
                  {logs.map((log, idx) => {
                    const isCheck = log.startsWith('✓') || log.startsWith('✅');
                    const isError = log.startsWith('Error');
                    return (
                      <div 
                        key={idx} 
                        className={`${isCheck ? 'text-[#5db872]' : isError ? 'text-red-400' : 'text-on-dark-soft'}`}
                      >
                        {log}
                      </div>
                    );
                  })}
                  <div ref={logsEndRef} />
                </div>

                <div className="text-[10px] text-muted-soft text-center italic">
                  Note: Scraping processes bypass CAPTCHAs and close browser instances immediately. Never stores image payloads.
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
