'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Trash, Check, Copy, ToggleLeft, ToggleRight, Settings, Link, Key, AlertCircle, ExternalLink, HelpCircle } from 'lucide-react';
import supabaseService from '../../services/supabase.service';
import { WebhookConfig } from '../../types';

interface WebhookSettingsProps {
  projectId: string;
}

export default function WebhookSettings({ projectId }: WebhookSettingsProps) {
  const [inboundConfigs, setInboundConfigs] = useState<WebhookConfig[]>([]);
  const [outboundUrl, setOutboundUrl] = useState('');
  const [outboundSecret, setOutboundSecret] = useState('');
  const [outboundEvents, setOutboundEvents] = useState<string[]>([]);
  const [outboundConfigId, setOutboundConfigId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingOutbound, setSavingOutbound] = useState(false);

  // Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [newSource, setNewSource] = useState<'stripe' | 'github' | 'custom'>('custom');
  const [newRole, setNewRole] = useState('cso');
  const [newPrefix, setNewPrefix] = useState('');
  const [newSecret, setNewSecret] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchConfigs = async () => {
    try {
      const supabase = supabaseService.getClient();

      // Fetch all webhook configs for this project
      const { data, error } = await supabase
        .from('webhook_configs')
        .select('*')
        .eq('project_id', projectId);

      if (error) throw error;

      const inbound = (data || []).filter((c: WebhookConfig) => c.direction === 'inbound');
      const outbound = (data || []).find((c: WebhookConfig) => c.direction === 'outbound');

      setInboundConfigs(inbound);

      if (outbound) {
        setOutboundConfigId(outbound.id);
        setOutboundUrl(outbound.url || '');
        setOutboundSecret(outbound.secret || '');
        setOutboundEvents(outbound.events || []);
      } else {
        setOutboundConfigId(null);
        setOutboundUrl('');
        setOutboundSecret('');
        setOutboundEvents([]);
      }
    } catch (err) {
      console.error('Failed to load webhook configurations:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfigs();
  }, [projectId]);

  // Generate a random webhook secret key
  const generateSecret = () => {
    const randomHex = Array.from({ length: 32 }, () =>
      Math.floor(Math.random() * 16).toString(16)
    ).join('');
    setNewSecret(`whsec_${randomHex}`);
  };

  useEffect(() => {
    if (showAddModal) {
      generateSecret();
    }
  }, [showAddModal]);

  const handleAddInbound = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const supabase = supabaseService.getClient();

      const { data, error } = await supabase
        .from('webhook_configs')
        .insert({
          project_id: projectId,
          direction: 'inbound',
          source: newSource,
          secret: newSecret,
          agent_role: newRole,
          task_prefix: newPrefix || null,
          is_active: true
        })
        .select()
        .single();

      if (error) throw error;

      setShowAddModal(false);
      setNewPrefix('');
      fetchConfigs();
    } catch (err) {
      console.error('Failed to add inbound webhook config:', err);
      alert('Error creating inbound webhook configuration.');
    }
  };

  const handleToggleInbound = async (config: WebhookConfig) => {
    try {
      const supabase = supabaseService.getClient();

      const { error } = await supabase
        .from('webhook_configs')
        .update({ is_active: !config.is_active })
        .eq('id', config.id);

      if (error) throw error;
      fetchConfigs();
    } catch (err) {
      console.error('Failed to toggle inbound webhook:', err);
    }
  };

  const handleDeleteInbound = async (id: string) => {
    if (!confirm('Are you sure you want to delete this inbound webhook?')) return;
    try {
      const supabase = supabaseService.getClient();

      const { error } = await supabase
        .from('webhook_configs')
        .delete()
        .eq('id', id);

      if (error) throw error;
      fetchConfigs();
    } catch (err) {
      console.error('Failed to delete inbound webhook:', err);
    }
  };

  const handleSaveOutbound = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingOutbound(true);
    try {
      const supabase = supabaseService.getClient();

      if (outboundConfigId) {
        // Update existing
        const { error } = await supabase
          .from('webhook_configs')
          .update({
            url: outboundUrl || null,
            secret: outboundSecret || 'sec_outbound_default',
            events: outboundEvents,
            is_active: outboundUrl ? true : false
          })
          .eq('id', outboundConfigId);

        if (error) throw error;
      } else {
        // Insert new
        const { data, error } = await supabase
          .from('webhook_configs')
          .insert({
            project_id: projectId,
            direction: 'outbound',
            url: outboundUrl || null,
            secret: outboundSecret || 'sec_outbound_default',
            events: outboundEvents,
            is_active: outboundUrl ? true : false
          })
          .select()
          .single();

        if (error) throw error;
        if (data) setOutboundConfigId(data.id);
      }

      alert('Outbound webhook settings saved successfully.');
      fetchConfigs();
    } catch (err) {
      console.error('Failed to save outbound webhook settings:', err);
      alert('Error saving outbound webhook configuration.');
    } finally {
      setSavingOutbound(false);
    }
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const toggleEventSubscription = (event: string) => {
    setOutboundEvents((prev) =>
      prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event]
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-6 text-xs text-[#85827D]">
        <div className="animate-spin mr-2 h-4 w-4 border-2 border-[#D97757] border-t-transparent rounded-full" />
        Loading webhook settings...
      </div>
    );
  }

  // Determine current hostname for copying URLs
  const host = typeof window !== 'undefined' ? window.location.origin : 'https://3rdmind.ai';

  return (
    <div className="space-y-8 col-span-1 lg:col-span-2">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Inbound Webhooks Panel */}
        <div className="bg-white border border-[#E5E0DA] rounded-3xl p-6 space-y-4 shadow-[0_2px_8px_rgba(25,25,25,0.01)] flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex justify-between items-center border-b border-[#F5F3EE] pb-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#85827D] flex items-center gap-1.5">
                <Link className="w-4 h-4 text-[#D97757]" />
                <span>Inbound Webhooks</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowAddModal(true)}
                className="flex items-center gap-1 bg-[#D97757] hover:bg-[#c66545] text-white rounded-xl px-2.5 py-1 text-[10px] font-bold transition-all cursor-pointer shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Webhook</span>
              </button>
            </div>

            {inboundConfigs.length === 0 ? (
              <div className="text-center py-8 text-xs text-[#85827D] italic">
                No inbound webhooks configured. Create one to trigger agent tasks via Stripe, GitHub, or custom services.
              </div>
            ) : (
              <div className="space-y-3">
                {inboundConfigs.map((config) => {
                  const webhookUrl = `${host}/api/webhooks/${config.source}?projectId=${projectId}`;
                  const isCopied = copiedId === config.id;

                  return (
                    <div
                      key={config.id}
                      className="bg-[#FBF9F6] border border-[#E5E0DA] rounded-2xl p-3.5 space-y-2 relative overflow-hidden"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-extrabold uppercase text-[#191919]">
                            {config.source} Hook
                          </span>
                          <span className="text-[9px] bg-white border border-[#E5E0DA] px-2 py-0.5 rounded-full font-bold uppercase text-[#5E5B56]">
                            Agent: {config.agent_role?.toUpperCase()}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleToggleInbound(config)}
                            className="text-[#D97757] hover:opacity-85 transition-opacity cursor-pointer shrink-0"
                          >
                            {config.is_active ? (
                              <ToggleRight className="w-6 h-6 text-[#D97757]" />
                            ) : (
                              <ToggleLeft className="w-6 h-6 text-[#85827D]" />
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteInbound(config.id)}
                            className="text-[#85827D] hover:text-red-500 transition-colors cursor-pointer"
                          >
                            <Trash className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      <div className="space-y-1.5 text-[10px]">
                        <div>
                          <span className="font-bold text-[#85827D] block">Endpoint URL:</span>
                          <div className="flex items-center gap-1.5 bg-white border border-[#E5E0DA] rounded-lg p-1.5 font-mono text-[9px] select-text truncate">
                            <span className="truncate flex-1">{webhookUrl}</span>
                            <button
                              type="button"
                              onClick={() => handleCopy(webhookUrl, config.id)}
                              className="text-[#D97757] hover:opacity-85 p-0.5 shrink-0"
                            >
                              {isCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </div>

                        {config.task_prefix && (
                          <div>
                            <span className="font-bold text-[#85827D]">Task Prefix:</span>{' '}
                            <span className="font-medium text-[#5E5B56]">"{config.task_prefix}"</span>
                          </div>
                        )}

                        <div className="flex items-center gap-1">
                          <Key className="w-3.5 h-3.5 text-[#85827D]" />
                          <span className="font-bold text-[#85827D]">Secret:</span>{' '}
                          <span className="font-mono text-[#5E5B56]">{config.secret.slice(0, 10)}...</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Outbound Webhooks Panel */}
        <form
          onSubmit={handleSaveOutbound}
          className="bg-white border border-[#E5E0DA] rounded-3xl p-6 space-y-4 shadow-[0_2px_8px_rgba(25,25,25,0.01)] flex flex-col justify-between"
        >
          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#85827D] border-b border-[#F5F3EE] pb-2 flex items-center gap-1.5">
              <ExternalLink className="w-4 h-4 text-[#D97757]" />
              <span>Outbound Webhooks (Dispatch Actions)</span>
            </h3>

            <div>
              <label className="block text-[9px] font-bold uppercase tracking-wider text-[#5E5B56] mb-1">
                POST Payload URL
              </label>
              <input
                type="url"
                value={outboundUrl}
                onChange={(e) => setOutboundUrl(e.target.value)}
                placeholder="https://yourserver.com/webhooks"
                className="w-full bg-[#FBF9F6] border border-[#E5E0DA] rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#D97757] font-semibold"
              />
            </div>

            <div>
              <label className="block text-[9px] font-bold uppercase tracking-wider text-[#5E5B56] mb-1">
                Verification Secret Key (For HMAC-SHA256 headers)
              </label>
              <input
                type="text"
                value={outboundSecret}
                onChange={(e) => setOutboundSecret(e.target.value)}
                placeholder="Generate or enter verification secret"
                className="w-full bg-[#FBF9F6] border border-[#E5E0DA] rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#D97757] font-mono font-semibold"
              />
            </div>

            <div>
              <label className="block text-[9px] font-bold uppercase tracking-wider text-[#5E5B56] mb-2">
                Subscribe to Events
              </label>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {[
                  { id: 'agent.task.completed', label: 'Task Completed' },
                  { id: 'agent.task.failed', label: 'Task Failed' },
                  { id: 'outreach.email.sent', label: 'Email Dispatched' },
                  { id: 'approval.needed', label: 'Approval Required' },
                  { id: 'weekly.digest.ready', label: 'Digest Compiled' },
                  { id: 'judge.task.failed', label: 'Quality Check Failed' }
                ].map((ev) => {
                  const checked = outboundEvents.includes(ev.id);
                  return (
                    <label
                      key={ev.id}
                      className={`flex items-center gap-2 p-2 rounded-xl border cursor-pointer select-none transition-all ${
                        checked
                          ? 'bg-[#191919] text-white border-transparent'
                          : 'bg-[#FBF9F6] text-[#5E5B56] border-[#E5E0DA] hover:bg-[#F4F0EB]'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleEventSubscription(ev.id)}
                        className="hidden"
                      />
                      <span className="text-[10px] font-extrabold">{ev.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={savingOutbound}
            className="w-full bg-[#D97757] hover:bg-[#c66545] text-white rounded-xl py-2 text-xs font-bold transition-all cursor-pointer text-center mt-2"
          >
            {savingOutbound ? 'Saving config...' : 'Save Outbound Config'}
          </button>
        </form>
      </div>

      {/* Add Webhook Modal */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#191919]/60 backdrop-blur-xs">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white border border-[#E5E0DA] w-full max-w-md rounded-3xl p-6 space-y-4 shadow-2xl relative"
            >
              <div className="flex justify-between items-center border-b border-[#F5F3EE] pb-2">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#191919]">
                  Configure Inbound Webhook
                </h3>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="text-[#85827D] hover:text-[#191919] font-bold text-xs cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleAddInbound} className="space-y-4 text-xs">
                <div>
                  <label className="block text-[9px] font-bold uppercase tracking-wider text-[#5E5B56] mb-1">
                    Event Provider Source
                  </label>
                  <select
                    value={newSource}
                    onChange={(e: any) => setNewSource(e.target.value)}
                    className="w-full bg-[#FBF9F6] border border-[#E5E0DA] rounded-xl px-3 py-2 text-xs focus:outline-none font-semibold cursor-pointer"
                  >
                    <option value="stripe">Stripe</option>
                    <option value="github">GitHub</option>
                    <option value="typeform">Typeform</option>
                    <option value="custom">Custom Endpoint</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[9px] font-bold uppercase tracking-wider text-[#5E5B56] mb-1">
                    Assign Action Agent Role
                  </label>
                  <select
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value)}
                    className="w-full bg-[#FBF9F6] border border-[#E5E0DA] rounded-xl px-3 py-2 text-xs focus:outline-none font-semibold cursor-pointer"
                  >
                    <option value="ceo">CEO (Alex)</option>
                    <option value="cmo">CMO (Maya)</option>
                    <option value="cto">CTO (Dev)</option>
                    <option value="cfo">CFO (Fin)</option>
                    <option value="cso">CSO (Sam)</option>
                    <option value="cro">CRO (Rei)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[9px] font-bold uppercase tracking-wider text-[#5E5B56] mb-1">
                    Task Template Prefix (Optional)
                  </label>
                  <input
                    type="text"
                    value={newPrefix}
                    onChange={(e) => setNewPrefix(e.target.value)}
                    placeholder="e.g. [Webhook Audit] or Custom instructions"
                    className="w-full bg-[#FBF9F6] border border-[#E5E0DA] rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#D97757] font-semibold"
                  />
                </div>

                <div className="bg-[#FBF9F6] border border-[#E5E0DA] rounded-2xl p-3.5 space-y-1.5">
                  <div className="flex justify-between items-center">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-[#85827D]">
                      Verification Key (Auto-Generated)
                    </span>
                    <button
                      type="button"
                      onClick={generateSecret}
                      className="text-[#D97757] hover:underline text-[9px] font-bold cursor-pointer"
                    >
                      Regenerate
                    </button>
                  </div>
                  <div className="font-mono text-[10px] break-all bg-white border border-[#E5E0DA] rounded-lg p-2 text-[#5E5B56] select-text">
                    {newSecret}
                  </div>
                </div>

                <div className="bg-[#F5F3EE] rounded-2xl p-3 flex items-start gap-2 text-[10px] text-[#5E5B56]">
                  <AlertCircle className="w-4 h-4 text-[#D97757] shrink-0 mt-0.5" />
                  <div>
                    <span className="font-extrabold text-[#191919] block">Integration Hook Setup</span>
                    Give this generated secret to your third-party service provider so signature hashing checks pass successfully on inbound delivery.
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full bg-[#D97757] hover:bg-[#c66545] text-white rounded-xl py-2 text-xs font-bold transition-all cursor-pointer text-center"
                >
                  Create Webhook Config
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
