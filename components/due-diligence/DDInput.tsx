'use client';

import React, { useState } from 'react';
import { X, Search, Sparkles } from 'lucide-react';

interface DDInputProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  userId: string;
  onSuccess: (reportId: string) => void;
}

export default function DDInput({ isOpen, onClose, projectId, userId, onSuccess }: DDInputProps) {
  const [targetName, setTargetName] = useState('');
  const [targetUrl, setTargetUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetName) {
      setError('Startup Name is required');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/due-diligence/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetName,
          targetUrl,
          projectId,
          userId
        })
      });
      const data = await res.json();
      
      if (data.success) {
        onSuccess(data.reportId);
        setTargetName('');
        setTargetUrl('');
        onClose();
      } else {
        setError(data.error || 'Failed to start due diligence analysis.');
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-[#141413]/40 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fadeIn select-none font-dmsans">
      <div className="w-full max-w-md bg-[#FFFFFF] border border-[#E5E0DA] rounded-2xl shadow-lg flex flex-col overflow-hidden animate-slideUp text-left">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 border-b border-hairline bg-[#FAF9F5]">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#cc785c]" />
            <span className="text-xs font-bold uppercase tracking-wider text-ink">Convene Research Agents</span>
          </div>
          <button 
            onClick={onClose}
            className="p-1 hover:bg-surface-cream-strong rounded text-muted hover:text-ink transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-[11px] text-red-700 rounded-lg font-medium leading-relaxed">
              {error}
            </div>
          )}

          {/* Target Name */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-soft">Startup Name</label>
            <div className="relative">
              <Search className="absolute left-3.5 top-3 w-4 h-4 text-muted-soft" />
              <input
                type="text"
                placeholder="e.g. Stripe, Airbnb"
                value={targetName}
                onChange={(e) => setTargetName(e.target.value)}
                disabled={loading}
                className="w-full bg-transparent border border-[#E5E0DA] focus:border-[#cc785c] rounded-xl pl-9 pr-3 py-2 text-xs text-ink focus:outline-none transition-all placeholder-muted-soft"
                required
              />
            </div>
          </div>

          {/* Target URL */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-soft">Startup URL / Domain (Optional)</label>
            <input
              type="text"
              placeholder="e.g. stripe.com"
              value={targetUrl}
              onChange={(e) => setTargetUrl(e.target.value)}
              disabled={loading}
              className="w-full bg-transparent border border-[#E5E0DA] focus:border-[#cc785c] rounded-xl px-3 py-2 text-xs text-ink focus:outline-none transition-all placeholder-muted-soft"
            />
          </div>

          <p className="text-[10px] text-muted-soft leading-relaxed">
            Spawns 7 parallel research agents analyzing TAM, competition, founder pedigree, product reviews, financial indicators, and red flags.
          </p>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-hairline">
            <button
              type="button"
              onClick={onClose}
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
              <span>{loading ? 'Launching Agents...' : 'Run Due Diligence'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
