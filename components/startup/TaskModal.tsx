'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { StartupAgent, AgentRole } from '../../types';
import ReactMarkdown from 'react-markdown';
import { X, Play, Sparkles, Loader2, Link2, Star } from 'lucide-react';

interface TaskModalProps {
  agent: StartupAgent;
  projectId: string;
  onClose: () => void;
  onTaskStarted?: () => void;
}

const suggestedChips: Record<AgentRole, string[]> = {
  ceo: [
    "Define this week's top 3 priorities",
    "Write go-to-market strategy",
    "Review team outputs and set direction"
  ],
  cmo: [
    "Write a LinkedIn campaign for this week",
    "Create email sequence for new users",
    "Research competitor marketing"
  ],
  cto: [
    "Write technical specification",
    "Define database schema",
    "Review architecture decisions"
  ],
  cfo: [
    "Build pricing strategy with competitor analysis",
    "Calculate unit economics",
    "Create 12-month revenue projection"
  ],
  cso: [
    "Find 10 leads matching our ICP and write outreach",
    "Write sales script for demo calls",
    "Create objection handling guide"
  ],
  cro: [
    "Analyze top 3 competitors in depth",
    "Define our ideal customer profile",
    "Research market size with sources"
  ]
};

const roleMeta: Record<AgentRole, { title: string; avatarBg: string; textClass: string }> = {
  ceo: { title: 'Chief Executive Officer', avatarBg: 'bg-blue-50 text-blue-600 border border-blue-200/50', textClass: 'text-blue-600' },
  cmo: { title: 'Chief Marketing Officer', avatarBg: 'bg-purple-50 text-purple-600 border border-purple-200/50', textClass: 'text-purple-600' },
  cto: { title: 'Chief Technology Officer', avatarBg: 'bg-teal-50 text-teal-600 border border-teal-200/50', textClass: 'text-teal-600' },
  cfo: { title: 'Chief Financial Officer', avatarBg: 'bg-amber-50 text-amber-600 border border-amber-200/50', textClass: 'text-amber-600' },
  cso: { title: 'Chief Sales Officer', avatarBg: 'bg-rose-50 text-rose-600 border border-rose-200/50', textClass: 'text-rose-600' },
  cro: { title: 'Chief Research Officer', avatarBg: 'bg-green-50 text-green-600 border border-green-200/50', textClass: 'text-green-600' },
};

export default function TaskModal({ agent, projectId, onClose, onTaskStarted }: TaskModalProps) {
  const [taskDescription, setTaskDescription] = useState('');
  const [gmailConnected, setGmailConnected] = useState(false);
  const [notionConnected, setNotionConnected] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [streamedOutput, setStreamedOutput] = useState('');
  const [taskCompleted, setTaskCompleted] = useState(false);
  const [createdTaskId, setCreatedTaskId] = useState<string | null>(null);
  const [modalRating, setModalRating] = useState<number | null>(null);
  const [hoveredRating, setHoveredRating] = useState<number | null>(null);
  const [ratingSubmitted, setRatingSubmitted] = useState(false);
  const [ratingSubmitting, setRatingSubmitting] = useState(false);
  const outputEndRef = useRef<HTMLDivElement>(null);

  const handleRateTask = async (stars: number) => {
    if (!createdTaskId || ratingSubmitting) return;
    setModalRating(stars);
    setRatingSubmitting(true);
    try {
      const res = await fetch('/api/learning/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId: createdTaskId,
          agentId: agent.id,
          projectId,
          rating: stars
        })
      });
      if (res.ok) {
        setRatingSubmitted(true);
      }
    } catch (err) {
      console.error('Failed to submit rating feedback in TaskModal:', err);
    } finally {
      setRatingSubmitting(false);
    }
  };

  const meta = roleMeta[agent.role];
  const chips = suggestedChips[agent.role] || [];

  useEffect(() => {
    // Scroll to bottom of streaming output
    outputEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [streamedOutput]);

  useEffect(() => {
    // Check active connectors
    fetch('/api/connectors/list?userId=00000000-0000-0000-0000-000000000000')
      .then((res) => res.json())
      .then((data) => {
        if (data && Array.isArray(data.connectors)) {
          const hasGmail = data.connectors.some((c: any) => c.slug === 'gmail' && c.isConnected);
          const hasNotion = data.connectors.some((c: any) => c.slug === 'notion' && c.isConnected);
          setGmailConnected(hasGmail);
          setNotionConnected(hasNotion);
        }
      })
      .catch((err) => console.warn('Failed to load active connectors inside TaskModal:', err));
  }, []);

  const handleRunTask = async () => {
    if (!taskDescription.trim()) return;

    setExecuting(true);
    setStreamedOutput('');
    if (onTaskStarted) onTaskStarted();

    try {
      const response = await fetch('/api/startup-agents/task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId: agent.id,
          taskDescription,
          projectId,
          userId: '00000000-0000-0000-0000-000000000000',
          triggeredBy: 'user'
        }),
      });

      const taskIdHeader = response.headers.get('x-task-id');
      if (taskIdHeader) {
        setCreatedTaskId(taskIdHeader);
      }

      if (!response.body) {
        throw new Error('ReadableStream not supported or empty response body.');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let resultText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        resultText += chunk;
        setStreamedOutput(resultText);
      }
    } catch (err: any) {
      setStreamedOutput((prev) => prev + `\n\n[Execution Error]: ${err.message || String(err)}`);
    } finally {
      // Do not reset executing immediately so user can view full logs. We just stop loading state.
      setTaskCompleted(true);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-[#191919]/40 backdrop-blur-md flex items-center justify-center p-4 font-dmsans"
    >
      <motion.div
        initial={{ scale: 0.98, y: 10 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.98, y: 10 }}
        className="bg-white border border-[#E5E0DA] rounded-[32px] w-full max-w-2xl h-[85vh] flex flex-col justify-between shadow-2xl relative overflow-hidden"
      >
        {/* Header */}
        <div className="p-6 border-b border-[#E5E0DA] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl ${meta?.avatarBg} flex items-center justify-center font-extrabold text-sm`}>
              {agent.role.slice(0, 1).toUpperCase()}
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#85827D]">Assign task to {agent.name}</span>
              <h2 className="text-sm font-extrabold text-[#191919]">{meta?.title}</h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 hover:bg-[#F4F0EB] text-[#5E5B56] hover:text-[#191919] rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-8 space-y-6">
          {!executing ? (
            <>
              {/* Task Textarea */}
              <div className="space-y-2">
                <textarea
                  value={taskDescription}
                  onChange={(e) => setTaskDescription(e.target.value)}
                  placeholder={`What should ${agent.name} do?`}
                  rows={4}
                  className="w-full bg-transparent border-0 text-[#191919] placeholder-[#85827D] focus:outline-none focus:ring-0 text-xl font-medium resize-none"
                  autoFocus
                />
              </div>

              {/* Suggestions chips */}
              <div className="space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#85827D] block">Suggested Templates</span>
                <div className="flex flex-wrap gap-2">
                  {chips.map((chip, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setTaskDescription(chip)}
                      className="text-xs bg-[#F4F0EB] hover:bg-[#ECE5DD] border border-[#E5E0DA] text-[#191919] rounded-full px-3 py-1.5 transition-colors cursor-pointer font-medium"
                    >
                      {chip}
                    </button>
                  ))}
                </div>
              </div>

              {/* Connector Badges */}
              <div className="pt-4 border-t border-[#E5E0DA] space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#85827D] block">Active Integrations</span>
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2 text-xs">
                    <Link2 className={`w-3.5 h-3.5 ${gmailConnected ? 'text-green-600' : 'text-[#85827D]'}`} />
                    <span className={gmailConnected ? 'text-[#191919] font-medium' : 'text-[#85827D]'}>
                      {gmailConnected 
                        ? 'Gmail connected — CSO can send real emails' 
                        : 'Gmail disconnected (will simulate email sends)'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <Link2 className={`w-3.5 h-3.5 ${notionConnected ? 'text-green-600' : 'text-[#85827D]'}`} />
                    <span className={notionConnected ? 'text-[#191919] font-medium' : 'text-[#85827D]'}>
                      {notionConnected 
                        ? 'Notion connected — outputs saved automatically' 
                        : 'Notion disconnected (saves locally only)'}
                    </span>
                  </div>
                </div>
              </div>
            </>
          ) : (
            /* Streaming Output Log */
            <div className="h-full flex flex-col gap-3">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#85827D]">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-[#D97757]" />
                <span>Live task execution logs</span>
              </div>
              <div className="flex-1 bg-[#FBF9F6] border border-[#E5E0DA] rounded-3xl p-5 overflow-y-auto max-h-[42vh] prose prose-sm max-w-none text-[#191919] text-xs">
                {streamedOutput ? (
                  <ReactMarkdown>{streamedOutput}</ReactMarkdown>
                ) : (
                  <p className="italic text-[#85827D]">Initializing execution stream...</p>
                )}
                <div ref={outputEndRef} />
              </div>

              {taskCompleted && createdTaskId && (
                <div className="p-4 bg-[#FBF9F6] border border-[#E5E0DA] rounded-2xl flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-[#5E5B56]">How was this output?</span>
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((stars) => (
                        <button
                          key={stars}
                          type="button"
                          disabled={ratingSubmitting || ratingSubmitted}
                          onClick={() => handleRateTask(stars)}
                          onMouseEnter={() => !ratingSubmitted && setHoveredRating(stars)}
                          onMouseLeave={() => !ratingSubmitted && setHoveredRating(null)}
                          className="p-0.5 hover:scale-110 transition-transform cursor-pointer"
                        >
                          <Star
                            className={`w-5 h-5 transition-colors ${
                              stars <= (hoveredRating || modalRating || 0)
                                ? 'fill-amber-400 text-amber-400'
                                : 'text-[#85827D] opacity-40'
                            }`}
                          />
                        </button>
                      ))}
                    </div>
                  </div>
                  {ratingSubmitted && (
                    <span className="text-xs font-bold text-emerald-700 bg-emerald-50/50 border border-emerald-200/50 px-2.5 py-1 rounded-lg">
                      Feedback saved!
                    </span>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-[#E5E0DA] bg-[#FBF9F6] flex items-center justify-between">
          {!executing ? (
            <>
              <div className="flex items-center gap-1 text-[11px] text-[#5E5B56] font-medium">
                <Sparkles className="w-3.5 h-3.5 text-[#D97757]" />
                <span>Runs asynchronously in background</span>
              </div>
              <button
                type="button"
                disabled={!taskDescription.trim()}
                onClick={handleRunTask}
                className="flex items-center gap-1.5 bg-[#D97757] hover:bg-[#c66545] disabled:bg-[#ECE5DD] disabled:text-[#85827D] disabled:cursor-not-allowed text-white rounded-xl px-5 py-2.5 text-xs font-bold transition-all cursor-pointer shadow-xs"
              >
                <Play className="w-3.5 h-3.5" />
                <span>Run task</span>
              </button>
            </>
          ) : (
            <>
              <span className="text-[11px] text-[#5E5B56] font-semibold">
                You can safely close this modal; task runs in the background.
              </span>
              <button
                type="button"
                onClick={onClose}
                className="bg-[#191919] hover:bg-[#2c2c2c] text-white rounded-xl px-5 py-2.5 text-xs font-bold transition-colors cursor-pointer"
              >
                Close & Return
              </button>
            </>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
