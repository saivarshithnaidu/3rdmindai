'use client';

import React, { useState } from 'react';
import { 
  Globe, MessageSquare, AlertCircle, CheckSquare, Send, Check, 
  Trash, ArrowUpRight, Flame, Smile, Meh, Frown
} from 'lucide-react';

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

interface MentionCardProps {
  mention: Mention;
  onUpdate: () => void;
}

export default function MentionCard({ mention, onUpdate }: MentionCardProps) {
  const [draft, setDraft] = useState(mention.response_draft || '');
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSaveResponse = async () => {
    if (!draft.trim()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/reputation/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mentionId: mention.id,
          responseText: draft
        })
      });
      const data = await res.json();
      if (data.success) {
        setSuccess(true);
        onUpdate();
        setTimeout(() => setSuccess(false), 2000);
      }
    } catch (err) {
      console.error('Failed to log brand response:', err);
    } finally {
      setSaving(false);
    }
  };

  const getSentimentIcon = () => {
    if (mention.sentiment === 'positive') return <Smile className="w-4 h-4 text-green-600" />;
    if (mention.sentiment === 'negative') return <Frown className="w-4 h-4 text-red-600" />;
    return <Meh className="w-4 h-4 text-gray-500" />;
  };

  const getUrgencyBadge = () => {
    const badges = {
      critical: 'bg-red-100 text-red-700 border-red-200/50',
      high: 'bg-orange-100 text-orange-700 border-orange-200/50',
      medium: 'bg-amber-100 text-amber-700 border-amber-200/50',
      low: 'bg-slate-100 text-slate-700 border-slate-200/50'
    };
    return (
      <span className={`text-[8px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border flex items-center gap-0.5 ${badges[mention.urgency]}`}>
        {mention.urgency === 'critical' && <Flame className="w-2.5 h-2.5 animate-bounce" />}
        {mention.urgency}
      </span>
    );
  };

  return (
    <div className={`p-5 rounded-2xl border bg-[#FFFFFF] shadow-3xs transition-all text-left font-dmsans ${
      mention.urgency === 'critical' 
        ? 'border-red-300 ring-2 ring-red-100' 
        : 'border-[#E5E0DA] hover:border-[#cc785c]'
    }`}>
      
      {/* Header Profile Info row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-hairline pb-3 mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-ink uppercase tracking-wide bg-surface-soft border border-hairline px-2.5 py-0.5 rounded-lg flex items-center gap-1">
            <Globe className="w-3.5 h-3.5 text-muted-soft" />
            <span>{mention.platform}</span>
          </span>
          <span className="text-xs font-serif text-ink">{mention.author || 'Anonymous'}</span>
        </div>

        <div className="flex items-center gap-2">
          {getUrgencyBadge()}
          <span className="text-[10px] text-muted-soft">{new Date(mention.found_at).toLocaleDateString()}</span>
          <a
            href={mention.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1 hover:bg-surface-soft rounded text-muted hover:text-[#cc785c] cursor-pointer"
            title="Open Source Link"
          >
            <ArrowUpRight className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>

      {/* Content text */}
      <div className="text-xs text-body leading-relaxed whitespace-pre-wrap font-inter italic border-l-2 border-hairline pl-3 my-4">
        "{mention.content}"
      </div>

      {/* Sentiment score indicator */}
      <div className="flex items-center gap-2 text-[10px] text-muted mt-2 mb-4 bg-surface-soft/40 border border-hairline/50 p-2 rounded-xl">
        {getSentimentIcon()}
        <span>Sentiment Rating:</span>
        <span className="font-mono font-bold text-ink">
          {mention.sentiment_score !== null ? (mention.sentiment_score > 0 ? `+${mention.sentiment_score.toFixed(2)}` : mention.sentiment_score.toFixed(2)) : '0.00'}
        </span>
      </div>

      {/* Draft response panel */}
      <div className="pt-3 border-t border-hairline space-y-3">
        <div className="flex items-center justify-between text-[10px] font-bold text-ink uppercase tracking-wider">
          <span>AI response draft</span>
          {mention.response_sent && (
            <span className="text-green-700 bg-green-50 border border-green-200 px-2 py-0.2 rounded-full uppercase tracking-wider text-[8px] flex items-center gap-0.5">
              <Check className="w-2.5 h-2.5" />
              <span>Response Logged</span>
            </span>
          )}
        </div>

        {mention.response_sent ? (
          <div className="p-3 bg-surface-soft/60 border border-hairline/80 rounded-xl text-xs text-muted leading-relaxed font-inter whitespace-pre-wrap">
            {mention.response_draft}
          </div>
        ) : (
          <div className="space-y-3">
            <textarea
              placeholder="Draft a response context-ready..."
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              disabled={saving}
              rows={2}
              className="w-full bg-[#FAF9F5] border border-[#E5E0DA] focus:border-[#cc785c] rounded-xl px-3 py-2 text-xs text-ink focus:outline-none placeholder-muted-soft resize-none font-inter"
            />
            <div className="flex justify-end">
              <button
                onClick={handleSaveResponse}
                disabled={saving || !draft.trim()}
                className="flex items-center gap-1.5 px-4.5 py-1.5 bg-[#cc785c] hover:bg-[#a9583e] text-white rounded-lg text-xs font-bold transition-all shadow-3xs cursor-pointer disabled:opacity-50"
              >
                {saving ? (
                  <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : success ? (
                  <Check className="w-3.5 h-3.5" />
                ) : (
                  <Send className="w-3.5 h-3.5 fill-white" />
                )}
                <span>{saving ? 'Saving...' : success ? 'Logged' : 'Approve & Dispatch'}</span>
              </button>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
