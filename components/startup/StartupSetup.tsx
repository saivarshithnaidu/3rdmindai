'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, Loader2, Sparkles, AlertCircle } from 'lucide-react';

interface StartupSetupProps {
  projectId: string;
  onDeployComplete: () => void;
}

export default function StartupSetup({ projectId, onDeployComplete }: StartupSetupProps) {
  const [companyName, setCompanyName] = useState('');
  const [product, setProduct] = useState('');
  const [targetMarket, setTargetMarket] = useState('');
  const [stage, setStage] = useState<'idea' | 'mvp' | 'early-revenue' | 'growth'>('idea');
  const [problem, setProblem] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [visibleAgents, setVisibleAgents] = useState<string[]>([]);

  const roles = [
    { key: 'ceo', name: 'Alex', title: 'CEO', desc: 'Strategy & Roadmap', color: 'bg-blue-500/10 text-blue-600 border-blue-200/50' },
    { key: 'cmo', name: 'Maya', title: 'CMO', desc: 'Marketing & Campaigns', color: 'bg-purple-500/10 text-purple-600 border-purple-200/50' },
    { key: 'cto', name: 'Dev', title: 'CTO', desc: 'Architecture & Code', color: 'bg-teal-500/10 text-teal-600 border-teal-200/50' },
    { key: 'cfo', name: 'Fin', title: 'CFO', desc: 'Pricing & Projections', color: 'bg-amber-500/10 text-amber-600 border-amber-200/50' },
    { key: 'cso', name: 'Sam', title: 'CSO', desc: 'Sales Scripts & Outreach', color: 'bg-rose-500/10 text-rose-600 border-rose-200/50' },
    { key: 'cro', name: 'Rei', title: 'CRO', desc: 'Intelligence & Research', color: 'bg-green-500/10 text-green-600 border-green-200/50' },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName || !product || !targetMarket || !problem) {
      setError('Please fill in all fields.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/startup-agents/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          userId: '00000000-0000-0000-0000-000000000000', // Default guest/demo user
          startupContext: {
            companyName,
            product,
            targetMarket,
            stage,
            problem,
          },
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to deploy team.');
      }

      // Animate agent cards one by one
      for (let i = 0; i < roles.length; i++) {
        await new Promise((resolve) => setTimeout(resolve, 800));
        setVisibleAgents((prev) => [...prev, roles[i].key]);
      }

      // Stagger final completion slightly
      await new Promise((resolve) => setTimeout(resolve, 1000));
      onDeployComplete();
    } catch (err: any) {
      setError(err.message || 'An error occurred during deployment.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F3EE] flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 font-dmsans">
      <div className="max-w-xl mx-auto w-full space-y-8">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#D97757]/10 text-[#D97757] border border-[#D97757]/20 shadow-[0_4px_16px_rgba(217,119,87,0.1)] mb-4">
            <Sparkles className="w-6 h-6 animate-pulse" />
          </div>
          <h2 className="font-lora text-3xl font-extrabold text-[#191919] tracking-tight">
            Deploy your founding team
          </h2>
          <p className="mt-2 text-sm text-[#5E5B56]">
            Configure your startup profile to spin up 6 persistent AI agents that manage strategy, marketing, development, finance, sales, and research.
          </p>
        </div>

        <AnimatePresence mode="wait">
          {!loading ? (
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="bg-white/80 backdrop-blur-md border border-[#E5E0DA] rounded-3xl p-8 shadow-[0_8px_32px_rgba(25,25,25,0.03)]"
            >
              <form onSubmit={handleSubmit} className="space-y-6">
                {error && (
                  <div className="flex items-center gap-2.5 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <div>
                  <label htmlFor="companyName" className="block text-xs font-bold uppercase tracking-wider text-[#5E5B56] mb-2">
                    Company Name
                  </label>
                  <input
                    type="text"
                    id="companyName"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="e.g. Acme AI"
                    className="w-full bg-[#FBF9F6] border border-[#E5E0DA] rounded-xl px-4 py-2.5 text-sm text-[#191919] focus:outline-none focus:bg-white focus:border-[#D97757] focus:ring-1 focus:ring-[#D97757] transition-all"
                  />
                </div>

                <div>
                  <label htmlFor="product" className="block text-xs font-bold uppercase tracking-wider text-[#5E5B56] mb-2">
                    What does your product do? (2-3 sentences)
                  </label>
                  <textarea
                    id="product"
                    value={product}
                    onChange={(e) => setProduct(e.target.value)}
                    placeholder="Describe your solution, core functionality, and value proposition..."
                    rows={3}
                    className="w-full bg-[#FBF9F6] border border-[#E5E0DA] rounded-xl px-4 py-2.5 text-sm text-[#191919] focus:outline-none focus:bg-white focus:border-[#D97757] focus:ring-1 focus:ring-[#D97757] transition-all resize-none"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="targetMarket" className="block text-xs font-bold uppercase tracking-wider text-[#5E5B56] mb-2">
                      Target Customer
                    </label>
                    <input
                      type="text"
                      id="targetMarket"
                      value={targetMarket}
                      onChange={(e) => setTargetMarket(e.target.value)}
                      placeholder="e.g. B2B Enterprise, Fintech Developers"
                      className="w-full bg-[#FBF9F6] border border-[#E5E0DA] rounded-xl px-4 py-2.5 text-sm text-[#191919] focus:outline-none focus:bg-white focus:border-[#D97757] focus:ring-1 focus:ring-[#D97757] transition-all"
                    />
                  </div>

                  <div>
                    <label htmlFor="stage" className="block text-xs font-bold uppercase tracking-wider text-[#5E5B56] mb-2">
                      Startup Stage
                    </label>
                    <select
                      id="stage"
                      value={stage}
                      onChange={(e) => setStage(e.target.value as any)}
                      className="w-full bg-[#FBF9F6] border border-[#E5E0DA] rounded-xl px-4 py-2.5 text-sm text-[#191919] focus:outline-none focus:bg-white focus:border-[#D97757] focus:ring-1 focus:ring-[#D97757] transition-all cursor-pointer"
                    >
                      <option value="idea">Idea Stage</option>
                      <option value="mvp">MVP Built</option>
                      <option value="early-revenue">Early Revenue</option>
                      <option value="growth">Scale & Growth</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label htmlFor="problem" className="block text-xs font-bold uppercase tracking-wider text-[#5E5B56] mb-2">
                    What is the core problem you solve?
                  </label>
                  <input
                    type="text"
                    id="problem"
                    value={problem}
                    onChange={(e) => setProblem(e.target.value)}
                    placeholder="e.g. Manual data entry consumes 30% of employee hours"
                    className="w-full bg-[#FBF9F6] border border-[#E5E0DA] rounded-xl px-4 py-2.5 text-sm text-[#191919] focus:outline-none focus:bg-white focus:border-[#D97757] focus:ring-1 focus:ring-[#D97757] transition-all"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full flex items-center justify-center gap-2 bg-[#D97757] hover:bg-[#c66545] text-white rounded-xl py-3 text-sm font-semibold transition-colors shadow-sm cursor-pointer"
                >
                  <Bot className="w-4 h-4" />
                  <span>Deploy team</span>
                </button>
              </form>
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white/80 backdrop-blur-md border border-[#E5E0DA] rounded-3xl p-8 shadow-[0_8px_32px_rgba(25,25,25,0.03)] text-center space-y-6"
            >
              <div className="flex flex-col items-center justify-center space-y-3">
                <Loader2 className="w-8 h-8 animate-spin text-[#D97757]" />
                <h3 className="font-lora text-lg font-bold text-[#191919]">Assembling Founding Team...</h3>
                <p className="text-xs text-[#5E5B56] max-w-sm">
                  Spinning up instances, loading custom personalities, initializing memory logs, and establishing inter-agent communication channels...
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-4 border-t border-[#E5E0DA]">
                {roles.map((role) => {
                  const deployed = visibleAgents.includes(role.key);
                  return (
                    <motion.div
                      key={role.key}
                      initial={{ opacity: 0.3, y: 5 }}
                      animate={deployed ? { opacity: 1, y: 0, scale: 1.02 } : {}}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        deployed 
                          ? `${role.color} shadow-xs` 
                          : 'border-dashed border-[#E5E0DA] bg-transparent text-[#85827D]'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold tracking-wide">{role.title}</span>
                        {deployed && <span className="text-[10px] bg-white px-1.5 py-0.5 rounded-full border border-current font-bold uppercase tracking-wider scale-90">Deployed</span>}
                      </div>
                      <div className="text-sm font-extrabold mt-1 text-[#191919]">{role.name}</div>
                      <div className="text-[9px] text-[#5E5B56] mt-0.5 truncate">{role.desc}</div>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
