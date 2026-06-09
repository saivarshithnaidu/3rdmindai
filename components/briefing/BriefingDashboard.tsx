'use client';

import React, { useState, useEffect } from 'react';
import {
  Mic,
  RefreshCw,
  Settings,
  Clock,
  Globe,
  Phone,
  Mail,
  Play,
  ChevronDown,
  ChevronUp,
  Check,
  Zap,
  Send,
  MessageSquare,
  Calendar,
  TrendingUp,
  Shield,
  DollarSign,
  Users,
  Target,
} from 'lucide-react';
import VoiceSelector from './VoiceSelector';
import BriefingPlayer from './BriefingPlayer';
import LiveFeed from '../stream/LiveFeed';
import { StreamEventType } from '../../types';

interface BriefingDashboardProps {
  projectId: string;
  userId: string;
}

interface BriefingConfig {
  id: string;
  delivery_time: string;
  timezone: string;
  whatsapp_number: string | null;
  email: string | null;
  voice_id: string;
  sections: string[];
  is_active: boolean;
}

interface BriefingRecord {
  id: string;
  briefing_date: string;
  script: string;
  audio_url: string | null;
  duration_secs: number | null;
  whatsapp_sent: boolean;
  email_sent: boolean;
  status: string;
  created_at: string;
}

const SECTION_OPTIONS = [
  { key: 'team_activity', label: 'Team Activity', icon: Users, description: 'Agent tasks completed yesterday' },
  { key: 'market_news', label: 'Market News', icon: TrendingUp, description: 'Industry intelligence & trends' },
  { key: 'reputation', label: 'Reputation', icon: Shield, description: 'New brand mentions & sentiment' },
  { key: 'price_alerts', label: 'Price Alerts', icon: Target, description: 'Price targets hit overnight' },
  { key: 'calendar', label: 'Calendar', icon: Calendar, description: "Today's meetings & events" },
  { key: 'priorities', label: 'Priorities', icon: Zap, description: 'CEO agent weekly priorities' },
  { key: 'funding_deadlines', label: 'Funding Deadlines', icon: DollarSign, description: 'Grant & funding deadlines approaching' },
];

const TIMEZONE_OPTIONS = [
  'Asia/Kolkata',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Berlin',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Australia/Sydney',
];

export default function BriefingDashboard({ projectId, userId }: BriefingDashboardProps) {
  const [config, setConfig] = useState<BriefingConfig | null>(null);
  const [briefings, setBriefings] = useState<BriefingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [expandedBriefingId, setExpandedBriefingId] = useState<string | null>(null);

  // Setup form state
  const [deliveryTime, setDeliveryTime] = useState('08:00');
  const [timezone, setTimezone] = useState('Asia/Kolkata');
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [email, setEmail] = useState('');
  const [voiceId, setVoiceId] = useState('rachel');
  const [sections, setSections] = useState<string[]>(
    SECTION_OPTIONS.map((s) => s.key)
  );

  // Fetch config and briefings
  const fetchData = async () => {
    try {
      const [configRes, briefingsRes] = await Promise.all([
        fetch(`/api/briefing/config?projectId=${projectId}&userId=${userId}`),
        fetch(`/api/briefing/list?projectId=${projectId}`),
      ]);

      const configData = await configRes.json();
      const briefingsData = await briefingsRes.json();

      if (configData.success && configData.config) {
        const c = configData.config;
        setConfig(c);
        setDeliveryTime(c.delivery_time || '08:00');
        setTimezone(c.timezone || 'Asia/Kolkata');
        setWhatsappNumber(c.whatsapp_number || '');
        setEmail(c.email || '');
        setVoiceId(c.voice_id || 'rachel');
        setSections(
          c.sections && Array.isArray(c.sections) && c.sections.length > 0
            ? c.sections
            : SECTION_OPTIONS.map((s) => s.key)
        );
      }

      if (briefingsData.success && Array.isArray(briefingsData.briefings)) {
        setBriefings(briefingsData.briefings);
      }
    } catch (err) {
      console.error('Failed to fetch briefing data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [projectId]);

  // Poll for generating briefings
  useEffect(() => {
    const hasGenerating = briefings.some((b) => b.status === 'generating');
    if (!hasGenerating) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/briefing/list?projectId=${projectId}`);
        const data = await res.json();
        if (data.success && Array.isArray(data.briefings)) {
          setBriefings(data.briefings);
        }
      } catch (err) {
        console.warn('Failed to poll briefing updates:', err);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [briefings, projectId]);

  const toggleSection = (key: string) => {
    setSections((prev) =>
      prev.includes(key) ? prev.filter((s) => s !== key) : [...prev, key]
    );
  };

  const handleSaveConfig = async () => {
    setSaving(true);
    try {
      const body: any = {
        projectId,
        userId,
        deliveryTime,
        timezone,
        whatsappNumber: whatsappNumber || null,
        email: email || null,
        voiceId,
        sections,
        isActive: true,
      };

      if (config?.id) {
        body.configId = config.id;
        const res = await fetch('/api/briefing/config', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (data.success) setConfig(data.config);
      } else {
        const res = await fetch('/api/briefing/config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (data.success) setConfig(data.config);
      }
    } catch (err) {
      console.error('Failed to save config:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleTestBriefing = async () => {
    setGenerating(true);
    try {
      const res = await fetch('/api/briefing/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, userId }),
      });
      const data = await res.json();
      if (data.success) {
        // Start polling
        setTimeout(() => fetchData(), 3000);
      }
    } catch (err) {
      console.error('Failed to trigger test briefing:', err);
    } finally {
      setGenerating(false);
    }
  };

  const handleGenerateBriefing = async () => {
    setGenerating(true);
    try {
      const res = await fetch('/api/briefing/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, userId }),
      });
      const data = await res.json();
      if (data.success) {
        setTimeout(() => fetchData(), 3000);
      }
    } catch (err) {
      console.error('Failed to trigger briefing generation:', err);
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-screen bg-canvas font-dmsans">
        <RefreshCw className="w-6 h-6 text-[#cc785c] animate-spin" />
        <span className="text-xs text-muted-soft mt-2.5">Loading briefing settings...</span>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto bg-canvas font-dmsans">
      <div className="max-w-4xl mx-auto w-full px-6 py-8 space-y-8">

        {/* Header */}
        <div className="text-left">
          <h2 className="font-lora text-2xl font-normal text-ink tracking-tight flex items-center gap-2">
            <Mic className="w-6 h-6 text-[#cc785c]" />
            Voice Briefing
          </h2>
          <p className="text-xs text-muted mt-1.5">
            Your daily AI briefing on WhatsApp — wake up to a 2-minute audio summary of everything that matters.
          </p>
        </div>

        {/* Setup Card */}
        <div className="bg-white border border-[#E5E0DA] rounded-2xl shadow-2xs overflow-hidden">
          <div className="px-6 py-4 border-b border-[#E5E0DA] bg-surface-soft/30 flex items-center gap-2">
            <Settings className="w-4 h-4 text-[#cc785c]" />
            <span className="text-xs font-bold text-ink uppercase tracking-wider">
              {config ? 'Briefing Configuration' : 'Setup Your Morning Briefing'}
            </span>
            {config?.is_active && (
              <span className="ml-auto text-[9px] font-bold text-[#2f7e70] bg-[#5db872]/10 border border-[#5db872]/20 px-2 py-0.5 rounded-full uppercase tracking-wide">
                Active
              </span>
            )}
          </div>

          <div className="p-6 space-y-6">
            {/* Delivery Time & Timezone */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-muted uppercase tracking-wider flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  Delivery Time
                </label>
                <input
                  type="time"
                  value={deliveryTime}
                  onChange={(e) => setDeliveryTime(e.target.value)}
                  className="w-full bg-white border border-[#E5E0DA] text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-[#cc785c] transition-colors"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-muted uppercase tracking-wider flex items-center gap-1">
                  <Globe className="w-3 h-3" />
                  Timezone
                </label>
                <select
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="w-full bg-white border border-[#E5E0DA] text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-[#cc785c] cursor-pointer transition-colors"
                >
                  {TIMEZONE_OPTIONS.map((tz) => (
                    <option key={tz} value={tz}>
                      {tz}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* WhatsApp & Email */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-muted uppercase tracking-wider flex items-center gap-1">
                  <Phone className="w-3 h-3" />
                  WhatsApp Number
                </label>
                <input
                  type="tel"
                  value={whatsappNumber}
                  onChange={(e) => setWhatsappNumber(e.target.value)}
                  placeholder="+91 98765 43210"
                  className="w-full bg-white border border-[#E5E0DA] text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-[#cc785c] placeholder:text-muted-soft transition-colors"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-muted uppercase tracking-wider flex items-center gap-1">
                  <Mail className="w-3 h-3" />
                  Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="founder@startup.com"
                  className="w-full bg-white border border-[#E5E0DA] text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-[#cc785c] placeholder:text-muted-soft transition-colors"
                />
              </div>
            </div>

            {/* Voice Selector */}
            <VoiceSelector selectedVoice={voiceId} onSelect={setVoiceId} />

            {/* Section Toggles */}
            <div className="space-y-3">
              <label className="text-[10px] font-bold text-muted uppercase tracking-wider block">
                Briefing Sections
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {SECTION_OPTIONS.map((section) => {
                  const isEnabled = sections.includes(section.key);
                  const Icon = section.icon;
                  return (
                    <button
                      key={section.key}
                      type="button"
                      onClick={() => toggleSection(section.key)}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all cursor-pointer text-left ${
                        isEnabled
                          ? 'border-[#cc785c]/30 bg-[#cc785c]/5'
                          : 'border-[#E5E0DA] bg-white hover:border-[#E5E0DA]/80'
                      }`}
                    >
                      <div
                        className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                          isEnabled
                            ? 'bg-[#cc785c] border-[#cc785c]'
                            : 'border-[#ccc] bg-white'
                        }`}
                      >
                        {isEnabled && <Check className="w-2.5 h-2.5 text-white" />}
                      </div>
                      <Icon
                        className={`w-3.5 h-3.5 shrink-0 ${
                          isEnabled ? 'text-[#cc785c]' : 'text-muted-soft'
                        }`}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-semibold text-ink">{section.label}</div>
                        <div className="text-[9px] text-muted-soft truncate">{section.description}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={handleTestBriefing}
                disabled={generating}
                className="flex items-center gap-1.5 px-4 py-2 border border-[#cc785c] text-[#cc785c] hover:bg-[#cc785c]/5 rounded-lg text-xs font-semibold cursor-pointer transition-colors disabled:opacity-50"
              >
                {generating ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Play className="w-3.5 h-3.5" />
                )}
                <span>Test Briefing</span>
              </button>

              <button
                onClick={handleSaveConfig}
                disabled={saving}
                className="flex items-center gap-1.5 px-5 py-2 bg-[#cc785c] hover:bg-[#a9583e] text-white rounded-lg text-xs font-bold cursor-pointer transition-colors shadow-2xs disabled:opacity-50"
              >
                {saving ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Check className="w-3.5 h-3.5" />
                )}
                <span>{config ? 'Update & Save' : 'Save & Activate'}</span>
              </button>

              {config && (
                <button
                  onClick={handleGenerateBriefing}
                  disabled={generating}
                  className="flex items-center gap-1.5 px-4 py-2 bg-[#2f7e70] hover:bg-[#256b5f] text-white rounded-lg text-xs font-semibold cursor-pointer transition-colors shadow-2xs disabled:opacity-50 ml-auto"
                >
                  {generating ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Send className="w-3.5 h-3.5" />
                  )}
                  <span>Generate Now</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Past Briefings List */}
        {briefings.length > 0 && (
          <div className="space-y-4">
            <h3 className="font-lora text-lg font-normal text-ink tracking-tight">
              Past Briefings
            </h3>

            <div className="space-y-3">
              {briefings.map((b) => {
                const isExpanded = expandedBriefingId === b.id;
                return (
                  <div
                    key={b.id}
                    className="bg-white border border-[#E5E0DA] rounded-xl shadow-2xs overflow-hidden"
                  >
                    {/* Briefing Card Header */}
                    <div className="px-5 py-3.5 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="w-9 h-9 rounded-full bg-[#cc785c]/10 flex items-center justify-center shrink-0">
                          <Mic className="w-4 h-4 text-[#cc785c]" />
                        </div>
                        <div className="min-w-0 flex-1 text-left">
                          <div className="text-xs font-bold text-ink">
                            {new Date(b.briefing_date).toLocaleDateString('en-IN', {
                              weekday: 'long',
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric',
                            })}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            {b.duration_secs && (
                              <span className="text-[9px] text-muted-soft">
                                {Math.floor(b.duration_secs / 60)}:{(b.duration_secs % 60).toString().padStart(2, '0')} min
                              </span>
                            )}
                            {b.whatsapp_sent && (
                              <span className="text-[8px] font-bold text-[#25D366] bg-[#25D366]/10 px-1.5 py-0.5 rounded-full uppercase tracking-wide flex items-center gap-0.5">
                                <MessageSquare className="w-2.5 h-2.5" />
                                WhatsApp
                              </span>
                            )}
                            {b.email_sent && (
                              <span className="text-[8px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-full uppercase tracking-wide flex items-center gap-0.5">
                                <Mail className="w-2.5 h-2.5" />
                                Email
                              </span>
                            )}
                            {b.status === 'generating' && (
                              <span className="text-[8px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded-full uppercase tracking-wide animate-pulse">
                                Generating...
                              </span>
                            )}
                            {b.status === 'failed' && (
                              <span className="text-[8px] font-bold text-red-700 bg-red-50 px-1.5 py-0.5 rounded-full uppercase tracking-wide">
                                Failed
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() =>
                          setExpandedBriefingId(isExpanded ? null : b.id)
                        }
                        className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-[#cc785c] hover:bg-[#cc785c]/5 rounded-lg cursor-pointer transition-colors"
                      >
                        {isExpanded ? (
                          <>
                            <ChevronUp className="w-3.5 h-3.5" />
                            <span>Collapse</span>
                          </>
                        ) : (
                          <>
                            <Play className="w-3.5 h-3.5" />
                            <span>Listen</span>
                          </>
                        )}
                      </button>
                    </div>

                    {/* Expanded: Audio Player + Script */}
                    {isExpanded && (
                      <div className="px-5 pb-4 space-y-3">
                        {b.audio_url ? (
                          <BriefingPlayer
                            audioUrl={b.audio_url}
                            script={b.script}
                            duration={b.duration_secs || undefined}
                          />
                        ) : (
                          <div className="bg-surface-soft/30 rounded-xl p-4">
                            <div className="text-xs font-semibold text-ink mb-2">
                              Script (Audio not available)
                            </div>
                            <div className="text-xs text-ink leading-relaxed whitespace-pre-wrap max-h-64 overflow-y-auto">
                              {b.script}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* LiveFeed */}
        <div className="border-t border-hairline pt-6 text-left">
          <h3 className="text-xs font-bold uppercase tracking-wider text-ink mb-3">
            Briefing Agent Live Stream
          </h3>
          <LiveFeed
            projectId={projectId}
            filterTypes={[
              StreamEventType.AGENT_STARTED,
              StreamEventType.AGENT_THINKING,
              StreamEventType.AGENT_COMPLETE,
              StreamEventType.STREAM_ERROR,
            ]}
            maxHeight="150px"
            compact={true}
          />
        </div>
      </div>
    </div>
  );
}
