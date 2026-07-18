'use client';

import React, { useState, useEffect } from 'react';
import { Sparkles, Loader2, ArrowUpRight, BarChart2, RefreshCw, Trash2, HelpCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ImprovementLoop from './ImprovementLoop';

interface LearningPanelProps {
  agentId: string;
  projectId: string;
  agentName: string;
}

export default function LearningPanel({ agentId, projectId, agentName }: LearningPanelProps) {
  const [analytics, setAnalytics] = useState<any>(null);
  const [strategies, setStrategies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [extracting, setExtracting] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [selectedStrategy, setSelectedStrategy] = useState<any>(null);

  const fetchLearningData = async () => {
    try {
      // 1. Fetch analytics
      const analyticsRes = await fetch(`/api/learning/analytics?agentId=${agentId}&projectId=${projectId}`);
      if (analyticsRes.ok) {
        const data = await analyticsRes.json();
        setAnalytics(data);
      }

      // 2. Fetch strategy history
      const strategyRes = await fetch(`/api/learning/strategy?agentId=${agentId}`);
      if (strategyRes.ok) {
        const data = await strategyRes.json();
        setStrategies(data.versions || []);
      }
    } catch (err) {
      console.error('Failed to load learning data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLearningData();
  }, [agentId, projectId]);

  const handleForceExtract = async () => {
    setExtracting(true);
    try {
      const res = await fetch('/api/learning/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId, projectId })
      });
      if (res.ok) {
        alert('Learning extraction complete. Updated strategies and insights!');
        await fetchLearningData();
      }
    } catch (err) {
      console.error('Failed to extract learnings:', err);
    } finally {
      setExtracting(false);
    }
  };

  const handleResetLearnings = async () => {
    const confirmed = window.confirm('Are you absolutely sure you want to reset all learnings? This will permanently delete all insights and strategy history. This action cannot be undone.');
    if (!confirmed) return;

    setResetting(true);
    try {
      // Call Supabase directly to delete learnings and strategies for this agent
      const res = await fetch('/api/learning/export?projectId=' + projectId);
      // Wait, we can define a clean reset using a new API route or RPC, or we can just send a delete request.
      // Let's create an endpoint in `/api/learning/extract` or just call a fetch delete. Let's make `/api/learning/strategy` support DELETE method to clean history!
      const deleteRes = await fetch(`/api/learning/strategy?agentId=${agentId}&projectId=${projectId}`, {
        method: 'DELETE'
      });
      
      if (deleteRes.ok) {
        alert('Learnings reset successfully.');
        await fetchLearningData();
      } else {
        alert('Failed to reset learnings.');
      }
    } catch (err) {
      console.error('Reset error:', err);
    } finally {
      setResetting(false);
    }
  };

  const getConfidenceLabel = (confidence: number) => {
    if (confidence < 0.4) return { text: 'Low', color: 'bg-red-50 text-red-700 border-red-200' };
    if (confidence < 0.6) return { text: 'Medium', color: 'bg-amber-50 text-amber-700 border-amber-200' };
    if (confidence < 0.8) return { text: 'High', color: 'bg-blue-50 text-blue-700 border-blue-200' };
    return { text: 'Very High', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 font-dmsans gap-2">
        <Loader2 className="w-5 h-5 text-[#D97757] animate-spin" />
        <span className="text-xs text-[#85827D]">Querying compounding intelligence...</span>
      </div>
    );
  }

  // Draw Quality Trend SVG Line Chart
  const renderTrendChart = () => {
    if (!analytics || !analytics.trend || analytics.trend.length === 0) {
      return (
        <div className="text-center py-12 border border-dashed border-[#E5E0DA] bg-[#FBF9F6] rounded-2xl text-xs text-[#85827D] italic">
          No task evaluations recorded yet. Run tasks to build trend insights.
        </div>
      );
    }

    const data = analytics.trend;
    const width = 260;
    const height = 110;
    const pad = 16;

    // Y axis ranges from 0 to 50
    const maxVal = 50;

    const points = data.map((d: any, idx: number) => {
      const x = pad + (idx / Math.max(1, data.length - 1)) * (width - 2 * pad);
      const y = height - pad - (d.score / maxVal) * (height - 2 * pad);
      return { x, y, score: d.score };
    });

    const pathD = points.map((p: any, idx: number) => `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

    return (
      <div className="bg-white border border-[#E5E0DA] rounded-3xl p-5 shadow-[0_4px_16px_rgba(25,25,25,0.01)] space-y-4">
        <div className="flex justify-between items-center text-xs">
          <span className="font-bold text-[#191919]">Quality Trend</span>
          <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full">
            {analytics.improvementRate > 0 ? `+${analytics.improvementRate} rate` : `${analytics.improvementRate} rate`}
          </span>
        </div>
        <div className="relative">
          <svg className="w-full" viewBox={`0 0 ${width} ${height}`} height={height}>
            {/* Grid lines */}
            <line x1={pad} y1={height - pad} x2={width - pad} y2={height - pad} stroke="#E5E0DA" strokeWidth="1" />
            <line x1={pad} y1={pad} x2={width - pad} y2={pad} stroke="#F5F3EE" strokeWidth="1" strokeDasharray="3" />
            <line x1={pad} y1={height / 2} x2={width - pad} y2={height / 2} stroke="#F5F3EE" strokeWidth="1" strokeDasharray="3" />

            {/* Area under the path */}
            {points.length > 1 && (
              <path
                d={`${pathD} L ${points[points.length - 1].x} ${height - pad} L ${points[0].x} ${height - pad} Z`}
                fill="rgba(217, 119, 87, 0.05)"
              />
            )}

            {/* Line path */}
            {points.length > 1 && (
              <path d={pathD} fill="none" stroke="#D97757" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            )}

            {/* Data points */}
            {points.map((p: any, idx: number) => (
              <g key={idx}>
                <circle cx={p.x} cy={p.y} r="4.5" fill="#ffffff" stroke="#D97757" strokeWidth="2.5" />
                <text x={p.x} y={p.y - 8} textAnchor="middle" fontSize="7.5" fontWeight="bold" fill="#191919">
                  {p.score}
                </text>
                <text x={p.x} y={height - 4} textAnchor="middle" fontSize="6.5" fill="#85827D" fontWeight="bold">
                  {idx + 1}
                </text>
              </g>
            ))}
          </svg>
        </div>
      </div>
    );
  };

  // Diff comparison builder
  const renderDiff = (strategy: any) => {
    if (!strategy) return null;
    const additions = strategy.strategy_additions || '';
    const removals = strategy.strategy_removals || '';

    const additionLines = additions.split('\n').filter((l: string) => l.trim().startsWith('•'));
    const removalLines = removals.split('\n').filter((l: string) => l.trim().startsWith('•'));

    return (
      <div className="space-y-4">
        {removalLines.length > 0 && (
          <div className="space-y-1">
            <span className="text-[9px] font-bold uppercase tracking-wider text-rose-600 block">Outdated Strategies (Removed)</span>
            <div className="bg-rose-50/50 border border-rose-100 rounded-2xl p-4 text-xs font-semibold text-rose-800 space-y-1.5">
              {removalLines.map((line: string, idx: number) => (
                <p key={idx} className="leading-relaxed">- {line.substring(2)}</p>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-1">
          <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-600 block">New Compiled Strategies (v{strategy.version})</span>
          <div className="bg-emerald-50/50 border border-emerald-100 rounded-2xl p-4 text-xs font-semibold text-emerald-800 space-y-1.5">
            {additionLines.map((line: string, idx: number) => (
              <p key={idx} className="leading-relaxed">+ {line.substring(2)}</p>
            ))}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 font-dmsans select-none pb-8 text-left">
      {/* Header Info */}
      <div className="bg-[#FBF9F6] border border-[#E5E0DA] rounded-3xl p-5 flex flex-col gap-1.5">
        <h3 className="text-sm font-extrabold text-[#191919]">Compounding Intelligence</h3>
        <p className="text-xs text-[#5E5B56] leading-relaxed font-semibold">
          {agentName} has analyzed performance trends across <span className="text-[#D97757] font-black">{analytics?.totalTasks || 0} tasks</span> to automatically evolve strategy prompts and identity rules.
        </p>
      </div>

      {/* SVG improvement loop */}
      <ImprovementLoop
        totalLearnings={analytics?.activeLearningsCount || 0}
        strategyVersion={analytics?.strategyVersion || 1}
        lastExtractionDate={strategies[0]?.created_at || null}
      />

      {/* Performance trend chart */}
      {renderTrendChart()}

      {/* Top learnings / insights list */}
      <div className="space-y-3">
        <div className="flex justify-between items-center text-xs">
          <span className="font-bold text-[#85827D] uppercase tracking-wider">Top Learned Insights</span>
          <span className="text-[10px] text-[#85827D] font-bold">{analytics?.topLearnings?.length || 0} active</span>
        </div>

        {(!analytics || !analytics.topLearnings || analytics.topLearnings.length === 0) ? (
          <div className="text-center py-8 border border-[#E5E0DA] bg-white rounded-3xl text-xs text-[#85827D] italic">
            No insights compiled yet.
          </div>
        ) : (
          <div className="space-y-3">
            {analytics.topLearnings.map((learn: any) => {
              const label = getConfidenceLabel(learn.confidence);
              return (
                <div key={learn.id} className="bg-white border border-[#E5E0DA] rounded-3xl p-4 space-y-2.5 shadow-2xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[9px] bg-[#FBF9F6] border border-[#E5E0DA] px-2 py-0.5 rounded font-bold uppercase text-[#5E5B56]">
                      {learn.learning_type}
                    </span>
                    <span className={`text-[9.5px] border px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${label.color}`}>
                      {label.text} Confidence
                    </span>
                  </div>
                  <p className="text-xs text-[#191919] font-semibold leading-relaxed">
                    {learn.insight}
                  </p>
                  <div className="flex justify-between items-center text-[9px] text-[#85827D] font-bold border-t border-[#F5F3EE] pt-2 mt-1">
                    <span>Evidence: {learn.evidence_count} tasks</span>
                    <span>Reinforced {new Date(learn.last_reinforced).toLocaleDateString()}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Strategy version history */}
      <div className="space-y-3">
        <span className="text-xs font-bold text-[#85827D] uppercase tracking-wider block">Strategy Version History</span>

        {strategies.length === 0 ? (
          <div className="text-center py-8 border border-[#E5E0DA] bg-white rounded-3xl text-xs text-[#85827D] italic">
            No strategy updates created yet (requires at least 5 active learnings).
          </div>
        ) : (
          <div className="bg-white border border-[#E5E0DA] rounded-3xl overflow-hidden shadow-2xs divide-y divide-[#F5F3EE]">
            {strategies.map((strat) => (
              <div key={strat.id} className="p-4 flex items-center justify-between hover:bg-[#FBF9F6]/50 transition-colors">
                <div>
                  <span className="text-xs font-extrabold text-[#191919] block">Strategy v{strat.version}</span>
                  <span className="text-[9.5px] text-[#85827D] font-bold block mt-0.5">
                    Triggered by {strat.triggered_by} • {new Date(strat.created_at).toLocaleDateString()}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedStrategy(strat)}
                  className="flex items-center gap-1 text-[10px] font-bold text-[#D97757] hover:underline uppercase tracking-wider cursor-pointer"
                >
                  <span>View Diff</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Strategy Diff Modal */}
      <AnimatePresence>
        {selectedStrategy && (
          <div className="fixed inset-0 bg-[#191919]/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn font-dmsans">
            <motion.div
              initial={{ scale: 0.98, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.98, y: 15 }}
              className="bg-white border border-[#E5E0DA] rounded-[32px] w-full max-w-xl flex flex-col justify-between max-h-[80vh] shadow-2xl relative overflow-hidden"
            >
              <div className="p-6 border-b border-[#E5E0DA] bg-[#FBF9F6] flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-extrabold text-[#191919]">Strategy Updates Comparison</h3>
                  <p className="text-[10px] text-[#85827D] font-bold uppercase mt-0.5">Version v{selectedStrategy.version} comparison</p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedStrategy(null)}
                  className="px-3.5 py-1.5 bg-white border border-[#E5E0DA] hover:bg-[#F4F0EB] text-xs font-bold rounded-xl cursor-pointer transition-colors"
                >
                  Close
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {renderDiff(selectedStrategy)}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Manual learning trigger & reset buttons */}
      <div className="flex gap-3 pt-4 border-t border-[#E5E0DA]">
        <button
          type="button"
          disabled={extracting || resetting}
          onClick={handleForceExtract}
          className="flex-1 flex items-center justify-center gap-2 bg-[#D97757] hover:bg-[#c66545] disabled:bg-[#ECE5DD] disabled:text-[#85827D] text-white rounded-xl py-2.5 text-xs font-bold transition-all cursor-pointer shadow-xs"
        >
          {extracting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          <span>Force Extract</span>
        </button>

        <button
          type="button"
          disabled={extracting || resetting}
          onClick={handleResetLearnings}
          className="flex-1 flex items-center justify-center gap-2 bg-white hover:bg-rose-50 border border-[#E5E0DA] hover:border-rose-200 text-[#5E5B56] hover:text-rose-700 rounded-xl py-2.5 text-xs font-bold transition-all cursor-pointer"
        >
          {resetting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5 text-rose-600" />}
          <span>Reset loop</span>
        </button>
      </div>
    </div>
  );
}
