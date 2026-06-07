'use client';

import React, { useState, useEffect } from 'react';
import { Shield, CheckCircle2, AlertTriangle, XCircle, Star, Sparkles, RefreshCw, BarChart2 } from 'lucide-react';
import { motion } from 'framer-motion';

interface JudgePanelProps {
  agentId: string;
  projectId: string;
}

export default function JudgePanel({ agentId, projectId }: JudgePanelProps) {
  const [stats, setStats] = useState({
    average_score: 0,
    pass_rate: 0,
    most_common_failure_dimension: 'None',
    total_evaluations: 0
  });
  
  const [evaluations, setEvaluations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadStatsAndEvaluations = async () => {
    setLoading(true);
    try {
      // Fetch stats
      const statsRes = await fetch(`/api/judge/stats?agentId=${agentId}&projectId=${projectId}`);
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData.stats);
      }

      // Fetch latest evaluated tasks for this agent
      // We can query agent tasks that have judge scores
      const supabase = (await import('../../services/supabase.service')).default.getClient();
      const { data: tasks, error } = await supabase
        .from('agent_tasks')
        .select('*')
        .eq('agent_id', agentId)
        .not('judge_score', 'is', null)
        .order('completed_at', { ascending: false })
        .limit(20);

      if (!error && tasks) {
        setEvaluations(tasks);
      }
    } catch (err) {
      console.error('Failed to load judge stats/evaluations:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStatsAndEvaluations();
  }, [agentId, projectId]);

  // Color helper for total score
  const getScoreColor = (score: number) => {
    if (score >= 35) return 'text-green-600 bg-green-50 border-green-200/50';
    if (score >= 20) return 'text-amber-600 bg-amber-50 border-amber-200/50';
    return 'text-red-600 bg-red-50 border-red-200/50';
  };

  const getBarColor = (score: number) => {
    if (score >= 35) return 'bg-green-500';
    if (score >= 20) return 'bg-amber-500';
    return 'bg-red-500';
  };

  const getDimensionBarColor = (score: number) => {
    if (score >= 8) return 'bg-green-500';
    if (score >= 5) return 'bg-amber-500';
    return 'bg-red-500';
  };

  return (
    <div className="space-y-6 font-dmsans h-full flex flex-col justify-between">
      <div className="space-y-6 flex-1 overflow-y-auto pr-1">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#E5E0DA] pb-3">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#85827D]">
            <Shield className="w-4 h-4 text-[#D97757]" />
            <span>Judge Agent Layer</span>
          </div>

          <button
            type="button"
            onClick={loadStatsAndEvaluations}
            className="p-1 hover:bg-[#F4F0EB] text-[#5E5B56] hover:text-[#191919] rounded-lg transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-[#85827D]" />
          </div>
        ) : (
          <>
            {/* Summary statistics */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[#FBF9F6] border border-[#E5E0DA] rounded-2xl p-3 text-center">
                <span className="text-[9px] font-bold uppercase tracking-wider text-[#85827D] block mb-1">Quality Avg</span>
                <span className="text-xl font-extrabold text-[#191919]">{stats.average_score}/50</span>
              </div>
              <div className="bg-[#FBF9F6] border border-[#E5E0DA] rounded-2xl p-3 text-center">
                <span className="text-[9px] font-bold uppercase tracking-wider text-[#85827D] block mb-1">Pass Rate</span>
                <span className="text-xl font-extrabold text-[#191919]">{stats.pass_rate}%</span>
              </div>
              <div className="col-span-2 bg-[#FBF9F6] border border-[#E5E0DA] rounded-2xl p-3 flex justify-between items-center px-4">
                <span className="text-[9px] font-bold uppercase tracking-wider text-[#85827D]">Weakest Area</span>
                <span className="text-xs font-extrabold text-[#D97757] uppercase tracking-wider">{stats.most_common_failure_dimension}</span>
              </div>
            </div>

            {/* Evaluations Feed */}
            <div className="space-y-4">
              <h4 className="text-[10px] font-bold uppercase tracking-wider text-[#85827D]">Evaluations Feed</h4>
              
              {evaluations.length === 0 ? (
                <div className="text-center py-8 border border-dashed border-[#E5E0DA] rounded-2xl bg-[#FBF9F6]">
                  <CheckCircle2 className="w-6 h-6 text-[#85827D] mx-auto mb-2 opacity-50" />
                  <p className="text-[11px] text-[#5E5B56] font-semibold">No evaluated outputs logged.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {evaluations.map((item) => (
                    <div
                      key={item.id}
                      className="bg-white border border-[#E5E0DA] rounded-2xl p-4 space-y-3 relative overflow-hidden"
                    >
                      {/* Title & Score */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="max-w-[70%]">
                          <h5 className="text-xs font-extrabold text-[#191919] truncate leading-tight">
                            {item.title}
                          </h5>
                          {item.revision_round > 0 && (
                            <span className="text-[8px] font-bold uppercase text-[#D97757] tracking-wider block mt-0.5">
                              Revised {item.revision_round} time{item.revision_round > 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                        <div className={`text-xs font-extrabold px-2 py-0.5 rounded-full border ${getScoreColor(item.judge_score)} flex items-center gap-1`}>
                          <span>{item.judge_score}/50</span>
                          {item.judge_passed ? (
                            <CheckCircle2 className="w-3 h-3 text-green-600" />
                          ) : (
                            <AlertTriangle className="w-3 h-3 text-amber-600" />
                          )}
                        </div>
                      </div>

                      {/* Main score bar */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-[8px] font-bold text-[#85827D] uppercase tracking-wider">
                          <span>Quality Threshold (35+)</span>
                          <span>{item.judge_score}/50</span>
                        </div>
                        <div className="w-full bg-[#ECE5DD] h-1.5 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${getBarColor(item.judge_score)} rounded-full`}
                            style={{ width: `${(item.judge_score / 50) * 100}%` }}
                          />
                        </div>
                      </div>

                      {/* Dimension breakdown */}
                      <div className="pt-2 border-t border-[#F5F3EE] space-y-2">
                        {/* We don't have the 5 scores stored on the task itself, but we can display the generic breakdown based on the feedback or simulate it, or wait: we can query the judge_evaluations table for this task!
                            Wait, to avoid making N queries, we can just fetch the judge_evaluations for the current agent and query them! Or we can approximate, or we can fetch them. Let's see: we can query judge_evaluations details dynamically when expanding the panel.
                            Wait, for a simple implementation: we can load them or render a standard breakdown since they are stored in the database! Yes, let's write a small state that maps taskId to evaluations. Let's do that! */}
                        <TaskDimensionBreakdown taskId={item.id} getDimensionBarColor={getDimensionBarColor} />
                      </div>

                      {/* Feedback */}
                      {item.judge_feedback && (
                        <div className="bg-[#FBF9F6] border border-[#E5E0DA] rounded-xl p-2.5">
                          <span className="text-[8px] font-bold uppercase tracking-wider text-[#85827D] block mb-1">Judge Feedback</span>
                          <p className="text-[11px] text-[#5E5B56] leading-relaxed">
                            {item.judge_feedback}
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// Subcomponent to fetch and render the 5 dimensions for a task
function TaskDimensionBreakdown({ taskId, getDimensionBarColor }: { taskId: string; getDimensionBarColor: (score: number) => string }) {
  const [evalDetail, setEvalDetail] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDetail = async () => {
      try {
        const supabase = (await import('../../services/supabase.service')).default.getClient();
        const { data, error } = await supabase
          .from('judge_evaluations')
          .select('*')
          .eq('task_id', taskId)
          .order('round', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!error && data) {
          setEvalDetail(data);
        }
      } catch (err) {
        console.error('Failed to load evaluation detail:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchDetail();
  }, [taskId]);

  if (loading) {
    return <div className="text-[9px] text-[#85827D] italic">Loading scores breakdown...</div>;
  }

  if (!evalDetail) {
    return null;
  }

  const dimensions = [
    { label: 'Completeness', score: evalDetail.score_complete },
    { label: 'Accuracy', score: evalDetail.score_accurate },
    { label: 'Actionability', score: evalDetail.score_actionable },
    { label: 'Role Fidelity', score: evalDetail.score_role },
    { label: 'Quality', score: evalDetail.score_quality }
  ];

  return (
    <div className="grid grid-cols-5 gap-2">
      {dimensions.map((d) => (
        <div key={d.label} className="text-center">
          <span className="text-[8px] text-[#85827D] block truncate font-medium">{d.label}</span>
          <div className="w-full bg-[#ECE5DD] h-1 rounded-full overflow-hidden mt-1 mb-0.5">
            <div
              className={`h-full ${getDimensionBarColor(d.score)}`}
              style={{ width: `${(d.score / 10) * 100}%` }}
            />
          </div>
          <span className="text-[9px] font-extrabold text-[#191919]">{d.score}/10</span>
        </div>
      ))}
    </div>
  );
}

// Loader helper
function Loader2({ className }: { className?: string }) {
  return <BarChart2 className={className} />;
}
