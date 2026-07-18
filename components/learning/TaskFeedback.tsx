'use client';

import React, { useState } from 'react';
import { Star, Edit3, Check, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface TaskFeedbackProps {
  taskId: string;
  agentId: string;
  projectId: string;
  agentName: string;
  originalOutput: string | null;
  onFeedbackSubmitted?: () => void;
}

export default function TaskFeedback({
  taskId,
  agentId,
  projectId,
  agentName,
  originalOutput,
  onFeedbackSubmitted
}: TaskFeedbackProps) {
  const [rating, setRating] = useState<number | null>(null);
  const [hoveredRating, setHoveredRating] = useState<number | null>(null);
  const [showEdit, setShowEdit] = useState(false);
  const [editedText, setEditedText] = useState(originalOutput || '');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmitRating = async (stars: number) => {
    setRating(stars);
    setSubmitting(true);
    try {
      const res = await fetch('/api/learning/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId,
          agentId,
          projectId,
          rating: stars
        })
      });
      if (res.ok) {
        setSubmitted(true);
        if (onFeedbackSubmitted) onFeedbackSubmitted();
      }
    } catch (err) {
      console.error('Failed to submit rating feedback:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveEdit = async () => {
    if (editedText.trim() === originalOutput?.trim()) {
      setShowEdit(false);
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/learning/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId,
          agentId,
          projectId,
          rating: rating || undefined,
          editedOutput: editedText
        })
      });
      if (res.ok) {
        setSubmitted(true);
        setShowEdit(false);
        if (onFeedbackSubmitted) onFeedbackSubmitted();
      }
    } catch (err) {
      console.error('Failed to submit edited output feedback:', err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-[#FBF9F6] border border-[#E5E0DA] rounded-2xl p-4 mt-3 space-y-3 font-dmsans select-none">
      {submitted ? (
        <motion.div
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2 text-xs font-bold text-emerald-700 bg-emerald-50/50 border border-emerald-200/50 p-2.5 rounded-xl justify-center text-center"
        >
          <Check className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>Thanks — {agentName} will learn from this</span>
        </motion.div>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-bold text-[#5E5B56]">How was this output?</span>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((stars) => (
                  <button
                    key={stars}
                    type="button"
                    disabled={submitting}
                    onClick={() => handleSubmitRating(stars)}
                    onMouseEnter={() => setHoveredRating(stars)}
                    onMouseLeave={() => setHoveredRating(null)}
                    className="p-0.5 hover:scale-110 transition-transform cursor-pointer disabled:opacity-50"
                  >
                    <Star
                      className={`w-4 h-4 transition-colors ${
                        stars <= (hoveredRating || rating || 0)
                          ? 'fill-amber-400 text-amber-400'
                          : 'text-[#85827D] opacity-40'
                      }`}
                    />
                  </button>
                ))}
              </div>
            </div>

            {originalOutput && !showEdit && (
              <button
                type="button"
                disabled={submitting}
                onClick={() => setShowEdit(true)}
                className="flex items-center gap-1.5 px-3 py-1 bg-white hover:bg-[#F4F0EB] border border-[#E5E0DA] text-[#191919] font-bold rounded-lg cursor-pointer transition-colors text-[10px] uppercase tracking-wider disabled:opacity-50"
              >
                <Edit3 className="w-3 h-3 text-[#D97757]" />
                <span>Edit output</span>
              </button>
            )}
          </div>

          <AnimatePresence>
            {showEdit && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="space-y-2 border-t border-[#E5E0DA] pt-3 mt-2 overflow-hidden"
              >
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#85827D] block">
                  Provide human correction directly:
                </span>
                <textarea
                  value={editedText}
                  onChange={(e) => setEditedText(e.target.value)}
                  rows={6}
                  className="w-full bg-white border border-[#E5E0DA] rounded-xl p-3 text-xs text-[#191919] focus:outline-none focus:border-[#D97757] transition-all resize-none font-medium leading-relaxed"
                />
                <div className="flex justify-end gap-2 text-[10px] font-bold uppercase tracking-wider">
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => setShowEdit(false)}
                    className="px-3.5 py-2 bg-white hover:bg-[#F4F0EB] text-[#5E5B56] border border-[#E5E0DA] rounded-lg cursor-pointer transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={handleSaveEdit}
                    className="flex items-center gap-1 px-4 py-2 bg-[#D97757] hover:bg-[#c66545] text-white rounded-lg cursor-pointer transition-colors shadow-xs"
                  >
                    {submitting && <Loader2 className="w-3 h-3 animate-spin" />}
                    <span>Save edit</span>
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
