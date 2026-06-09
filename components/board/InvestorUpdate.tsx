'use client';

import React, { useState } from 'react';
import { Mail, Copy, Check, Sparkles, RefreshCw } from 'lucide-react';

interface InvestorUpdateProps {
  projectId: string;
}

export default function InvestorUpdate({ projectId }: InvestorUpdateProps) {
  const [updateText, setUpdateText] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const generateUpdate = async () => {
    setLoading(true);
    setUpdateText('');
    setCopied(false);
    
    try {
      const res = await fetch('/api/board/investor-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId })
      });
      const data = await res.json();
      if (data.success) {
        setUpdateText(data.update);
      }
    } catch (err) {
      console.error('Failed to generate investor update:', err);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(updateText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Helper to extract subject line if present
  let subject = 'Monthly Investor Update';
  let emailBody = updateText;
  if (updateText.startsWith('SUBJECT:')) {
    const lines = updateText.split('\n');
    subject = lines[0].replace('SUBJECT:', '').trim();
    emailBody = lines.slice(1).join('\n').trim();
  }

  return (
    <div className="bg-[#FFFFFF] border border-[#E5E0DA] rounded-2xl p-6 shadow-2xs text-left">
      <div className="flex items-center justify-between border-b border-hairline pb-4 mb-6">
        <div className="flex items-center gap-2">
          <Mail className="w-5 h-5 text-[#cc785c]" />
          <div>
            <h2 className="font-serif text-xl font-normal text-ink">Investor Update Compiler</h2>
            <p className="text-xs text-muted mt-0.5">Synthesize startup memory facts and board actions into shareholder emails.</p>
          </div>
        </div>

        {!updateText && !loading && (
          <button
            onClick={generateUpdate}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#cc785c] hover:bg-[#a9583e] text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 fill-white" />
            <span>Generate Update</span>
          </button>
        )}

        {updateText && (
          <div className="flex items-center gap-2">
            <button
              onClick={copyToClipboard}
              className="flex items-center gap-1 px-3 py-1.5 border border-[#E5E0DA] hover:border-[#cc785c] text-ink hover:text-[#cc785c] rounded-lg text-xs font-semibold cursor-pointer transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
            <button
              onClick={generateUpdate}
              disabled={loading}
              className="flex items-center gap-1 px-3 py-1.5 bg-surface-cream-strong hover:bg-surface-cream-strong/85 text-ink rounded-lg text-xs font-semibold cursor-pointer transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Regenerate</span>
            </button>
          </div>
        )}
      </div>

      {loading && (
        <div className="flex flex-col items-center justify-center py-20">
          <span className="w-8 h-8 border-4 border-[#cc785c] border-t-transparent rounded-full animate-spin" />
          <span className="text-xs text-muted-soft mt-2.5">Aggregating milestones and financials...</span>
        </div>
      )}

      {!updateText && !loading && (
        <div className="text-center py-14 border border-dashed border-hairline rounded-xl max-w-md mx-auto space-y-3 bg-surface-soft/10">
          <Mail className="w-8 h-8 text-muted-soft mx-auto" />
          <div className="space-y-1">
            <h4 className="text-xs font-bold text-ink uppercase tracking-wider">No Draft Generated</h4>
            <p className="text-[11px] text-muted-soft leading-relaxed max-w-xs mx-auto">
              Synthesize an investor briefing summarizing recent KPIs, proposed board resolutions, and asks.
            </p>
          </div>
        </div>
      )}

      {updateText && !loading && (
        <div className="border border-hairline rounded-xl overflow-hidden shadow-3xs">
          {/* Email Client Header Frame */}
          <div className="bg-[#FAF9F5] border-b border-hairline p-4 space-y-2 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-bold text-muted-soft w-12 text-right">From:</span>
              <span className="text-ink font-semibold">boardroom@3rdmind.ai (Board of Directors)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-muted-soft w-12 text-right">To:</span>
              <span className="text-ink font-semibold">investors@shareholders.com</span>
            </div>
            <div className="flex items-center gap-2 pt-2 border-t border-hairline/50">
              <span className="font-bold text-muted-soft w-12 text-right">Subject:</span>
              <span className="text-[#cc785c] font-bold">{subject}</span>
            </div>
          </div>

          {/* Email Client Body Frame */}
          <div className="p-6 bg-[#FFFFFF] overflow-y-auto max-h-[400px]">
            <div className="prose prose-sm text-xs font-dmsans text-body leading-relaxed whitespace-pre-wrap max-w-none">
              {emailBody}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
