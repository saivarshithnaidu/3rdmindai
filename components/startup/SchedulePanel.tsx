'use client';

import React, { useState, useEffect } from 'react';
import { Calendar, Plus, X, Trash2, Loader2, Sparkles, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface SchedulePanelProps {
  agentId: string;
  projectId: string;
}

export default function SchedulePanel({ agentId, projectId }: SchedulePanelProps) {
  const [schedules, setSchedules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [taskTemplate, setTaskTemplate] = useState('');
  const [cronExpression, setCronExpression] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadSchedules = async () => {
    try {
      const res = await fetch(`/api/startup-agents/schedule?projectId=${projectId}`);
      if (res.ok) {
        const data = await res.json();
        // Filter schedules for this agent
        const agentSchedules = (data.schedules || []).filter((s: any) => s.agent_id === agentId);
        setSchedules(agentSchedules);
      }
    } catch (err) {
      console.error('Failed to load schedules:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSchedules();
  }, [agentId]);

  const handleAddSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTemplate.trim() || !cronExpression.trim()) return;

    setSubmitting(true);
    try {
      const res = await fetch('/api/startup-agents/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId,
          projectId,
          taskTemplate,
          cron: cronExpression,
        }),
      });

      if (res.ok) {
        setTaskTemplate('');
        setCronExpression('');
        setIsAdding(false);
        loadSchedules();
      } else {
        const errData = await res.json();
        alert(errData.error || 'Failed to create schedule.');
      }
    } catch (err) {
      console.error('Failed to create schedule:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeactivate = async (scheduleId: string) => {
    const confirm = window.confirm('Are you sure you want to deactivate this schedule?');
    if (!confirm) return;

    try {
      const res = await fetch('/api/startup-agents/schedule', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduleId }),
      });

      if (res.ok) {
        loadSchedules();
      }
    } catch (err) {
      console.error('Failed to deactivate schedule:', err);
    }
  };

  return (
    <div className="space-y-4 font-dmsans h-full flex flex-col justify-between">
      <div className="space-y-4 flex-1 overflow-y-auto pr-1">
        <div className="flex items-center justify-between border-b border-[#E5E0DA] pb-3">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#85827D]">
            <Calendar className="w-4 h-4 text-[#D97757]" />
            <span>Execution Schedules</span>
          </div>

          <button
            type="button"
            onClick={() => setIsAdding(!isAdding)}
            className="p-1 hover:bg-[#F4F0EB] text-[#5E5B56] hover:text-[#191919] rounded-lg transition-colors cursor-pointer"
          >
            {isAdding ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          </button>
        </div>

        <AnimatePresence>
          {isAdding && (
            <motion.form
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              onSubmit={handleAddSchedule}
              className="bg-[#FBF9F6] border border-[#E5E0DA] rounded-2xl p-4 space-y-3 overflow-hidden"
            >
              <div>
                <label htmlFor="taskTemplate" className="block text-[10px] font-bold uppercase tracking-wider text-[#5E5B56] mb-1.5">
                  Task Prompt Template
                </label>
                <textarea
                  id="taskTemplate"
                  rows={3}
                  value={taskTemplate}
                  onChange={(e) => setTaskTemplate(e.target.value)}
                  placeholder="Task template to execute (e.g. Generate weekly reports...)"
                  className="w-full bg-white border border-[#E5E0DA] rounded-xl px-3 py-2 text-xs text-[#191919] focus:outline-none focus:border-[#D97757] transition-all resize-none"
                />
              </div>

              <div>
                <label htmlFor="cronExpr" className="block text-[10px] font-bold uppercase tracking-wider text-[#5E5B56] mb-1.5">
                  Cron Expression
                </label>
                <input
                  type="text"
                  id="cronExpr"
                  value={cronExpression}
                  onChange={(e) => setCronExpression(e.target.value)}
                  placeholder="e.g. 0 9 * * 1-5 (weekday 9am)"
                  className="w-full bg-white border border-[#E5E0DA] rounded-xl px-3 py-2.5 text-xs text-[#191919] focus:outline-none focus:border-[#D97757] transition-all"
                />
                <span className="text-[9px] text-[#85827D] block mt-1 leading-normal">
                  Format: minute hour day-of-month month day-of-week
                </span>
              </div>

              <button
                type="submit"
                disabled={submitting || !taskTemplate.trim() || !cronExpression.trim()}
                className="w-full flex items-center justify-center gap-1.5 bg-[#D97757] hover:bg-[#c66545] disabled:bg-[#ECE5DD] disabled:text-[#85827D] text-white rounded-xl py-2 text-xs font-bold transition-all cursor-pointer"
              >
                {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                <span>Create Schedule</span>
              </button>
            </motion.form>
          )}
        </AnimatePresence>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-[#85827D]" />
          </div>
        ) : schedules.length === 0 ? (
          <div className="text-center py-10 border border-dashed border-[#E5E0DA] rounded-2xl bg-[#FBF9F6]">
            <Calendar className="w-6 h-6 text-[#85827D] mx-auto mb-2 opacity-50" />
            <p className="text-[11px] text-[#5E5B56] font-semibold">No schedules defined for this agent.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {schedules.map((sched) => (
              <div
                key={sched.id}
                className={`border rounded-2xl p-4 space-y-2 relative overflow-hidden bg-white ${
                  sched.is_active ? 'border-[#E5E0DA]' : 'border-[#E5E0DA]/40 opacity-50'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <span className="text-[10px] font-extrabold text-[#191919] bg-[#F4F0EB] px-2 py-0.5 rounded border border-[#E5E0DA] font-mono">
                      {sched.cron_expression}
                    </span>
                    <p className="text-xs text-[#191919] font-medium leading-relaxed pt-1.5 whitespace-pre-wrap">
                      {sched.task_template}
                    </p>
                  </div>

                  {sched.is_active && (
                    <button
                      type="button"
                      onClick={() => handleDeactivate(sched.id)}
                      className="p-1.5 hover:bg-red-50 text-[#85827D] hover:text-red-600 rounded-lg transition-colors cursor-pointer shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <div className="text-[9px] text-[#85827D] font-bold border-t border-[#E5E0DA] pt-2 mt-2 space-y-0.5">
                  <div>Next Trigger: {sched.next_trigger ? new Date(sched.next_trigger).toLocaleString() : 'Never'}</div>
                  {sched.last_triggered && (
                    <div>Last Executed: {new Date(sched.last_triggered).toLocaleString()}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
