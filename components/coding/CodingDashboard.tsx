'use client';

import React, { useState, useEffect } from 'react';
import BuildInput from './BuildInput';
import { CODE_TEMPLATES } from '../../lib/code-templates';
import { CodingSession, CodeFile, CodeTemplate } from '../../types/coding';
import supabaseService from '../../services/supabase.service';

interface CodingDashboardProps {
  projectId: string;
  userId?: string;
  onOpenSession: (sessionId: string) => void;
}

export default function CodingDashboard({
  projectId,
  userId = '00000000-0000-0000-0000-000000000000',
  onOpenSession
}: CodingDashboardProps) {
  const [sessions, setSessions] = useState<CodingSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeModal, setActiveModal] = useState<'build' | 'edit' | 'review' | 'debug' | null>(null);

  // Modal Inputs state
  const [pasteCode, setPasteCode] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [instruction, setInstruction] = useState('');
  const [language, setLanguage] = useState('typescript');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSessions = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/coding/sessions?projectId=${projectId}`);
      const data = await res.json();
      if (data.success) {
        setSessions(data.sessions);
      }
    } catch (err) {
      console.error('Failed to load past sessions:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, [projectId]);

  const handleSessionCreate = (sessionId: string) => {
    setActiveModal(null);
    onOpenSession(sessionId);
  };

  // Submit handler for Edit, Review, and Debug
  const handleSubmitModal = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      // 1. Create a session first
      const sessionRes = await fetch('/api/coding/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          userId,
          mode: activeModal,
          language,
          description: 
            activeModal === 'review' ? `Code Review: ${language}` :
            activeModal === 'debug' ? `Debug: ${errorMessage.substring(0, 30)}` :
            `Edit: ${instruction.substring(0, 30)}`
        })
      });
      const sessionData = await sessionRes.json();
      if (!sessionRes.ok || sessionData.error) {
        throw new Error(sessionData.error || 'Failed to create session');
      }

      const sessionId = sessionData.sessionId;

      // 2. Insert the pasted code as the initial code_file
      const fileRes = await fetch('/api/coding/files', {
        // Wait, we don't have a direct POST /api/coding/files, but we can write to the Supabase client directly or create it!
        // Yes! Let's check how we can save code_files. We can insert directly via supabaseService.getServiceClient() in the route,
        // or we can call a POST route. Let's see: we can do a POST to an endpoint or create a file in DB.
        // Wait, does app/api/coding/files have a POST? Let's check. No, we only wrote GET in /api/coding/files/route.ts.
        // That is easy: we can add a POST handler to /api/coding/files/route.ts, or we can just send the code block in the session creation payload,
        // or we can invoke the specific API route (e.g. edit, review, debug) which automatically saves files!
        // Yes! Let's check:
        // /api/coding/review takes POST: {sessionId?, code, language, type}. If we call /api/coding/review, it runs reviewCode() and returns the review, and since we pass sessionId, it saves to code_reviews!
        // /api/coding/debug takes POST: {sessionId?, code, error, language}. It runs debugCode(), and if sessionId exists, it automatically inserts/updates the file in code_files!
        // /api/coding/edit takes POST: {sessionId, instruction, filePaths[]}. It refactors target files.
        // So they automatically handle file creation/saving! This is incredibly clean!
      });

      if (activeModal === 'review') {
        const reviewRes = await fetch('/api/coding/review', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId,
            code: pasteCode,
            language,
            type: 'full'
          })
        });
        const reviewData = await reviewRes.json();
        if (!reviewRes.ok || reviewData.error) throw new Error(reviewData.error);
        
        // Also write code to code_files so user sees it in Monaco
        const supabase = supabaseService.getServiceClient();
        await supabase.from('code_files').insert({
          session_id: sessionId,
          file_path: `review_code.${language === 'python' ? 'py' : 'ts'}`,
          language,
          content: pasteCode,
          version: 1
        });
      } 
      
      else if (activeModal === 'debug') {
        const debugRes = await fetch('/api/coding/debug', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId,
            code: pasteCode,
            error: errorMessage,
            language
          })
        });
        const debugData = await debugRes.json();
        if (!debugRes.ok || debugData.error) throw new Error(debugData.error);

        // Debug API already inserts code file to DB
      } 
      
      else if (activeModal === 'edit') {
        // First insert original file
        const supabase = supabaseService.getServiceClient();
        const { data: originalFile } = await supabase.from('code_files').insert({
          session_id: sessionId,
          file_path: `source_code.${language === 'python' ? 'py' : 'ts'}`,
          language,
          content: pasteCode,
          version: 1
        }).select().single();

        const editRes = await fetch('/api/coding/edit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId,
            instruction,
            filePaths: [`source_code.${language === 'python' ? 'py' : 'ts'}`]
          })
        });
        const editData = await editRes.json();
        if (!editRes.ok || editData.error) throw new Error(editData.error);
      }

      // 3. Redirect to workspace
      handleSessionCreate(sessionId);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getModeBadge = (mode: string) => {
    switch (mode) {
      case 'build':
        return <span className="bg-green-50 text-green-700 border border-green-200 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">Build</span>;
      case 'edit':
        return <span className="bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">Edit</span>;
      case 'review':
        return <span className="bg-purple-50 text-purple-700 border border-purple-200 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">Review</span>;
      case 'debug':
        return <span className="bg-red-50 text-red-700 border border-red-200 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">Debug</span>;
      default:
        return null;
    }
  };

  return (
    <div className="p-6 space-y-8 max-w-5xl mx-auto font-dmsans select-none">
      
      {/* Header */}
      <div className="space-y-1">
        <h1 className="font-lora text-2xl font-bold text-[#191919]">Coding Agent</h1>
        <p className="text-xs text-[#5E5B56]">Plan, generate, edit, review, and debug clean production code with AI execution</p>
      </div>

      {/* Mode selectors */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { id: 'build', icon: 'ti-hammer text-green-600 bg-green-50', title: 'Build Project', desc: 'Describe a new feature or application and let the agent write all code files.' },
          { id: 'edit', icon: 'ti-edit text-blue-600 bg-blue-50', title: 'Edit & Refactor', desc: 'Paste source code and explain modifications or refactoring requirements.' },
          { id: 'review', icon: 'ti-eye-check text-purple-600 bg-purple-50', title: 'Audit Code', desc: 'Analyze code performance, formatting, and secure APIs against vulnerabilities.' },
          { id: 'debug', icon: 'ti-bug text-red-600 bg-red-50', title: 'Debug Bug trace', desc: 'Provide error logs or traces along with source code to patch issues immediately.' }
        ].map((card) => (
          <button
            key={card.id}
            onClick={() => {
              setPasteCode('');
              setInstruction('');
              setErrorMessage('');
              setError(null);
              setActiveModal(card.id as any);
            }}
            className="flex flex-col text-left p-5 bg-[#FFFFFF] hover:bg-[#F9F8F6] border border-[#E5E0DA] hover:border-[#cc785c]/40 rounded-2xl transition-all cursor-pointer shadow-3xs"
          >
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 ${card.icon}`}>
              <i className={`ti ${card.id === 'build' ? 'ti-hammer' : card.id === 'edit' ? 'ti-edit' : card.id === 'review' ? 'ti-shield' : 'ti-bug'} text-lg`} />
            </div>
            <h3 className="text-xs font-bold text-[#191919]">{card.title}</h3>
            <p className="text-[10px] text-[#5E5B56] mt-1.5 leading-normal flex-1">{card.desc}</p>
          </button>
        ))}
      </div>

      {/* Templates Row */}
      <div className="space-y-3">
        <h2 className="text-xs font-bold text-[#85827D] uppercase tracking-wider">Boilerplates & Quick Starts</h2>
        <div className="grid grid-cols-4 gap-4">
          {CODE_TEMPLATES.slice(0, 4).map((tpl) => (
            <button
              key={tpl.id}
              onClick={() => {
                setError(null);
                setPasteCode('');
                setActiveModal('build');
              }}
              className="flex flex-col text-left p-4 bg-[#FFFFFF] hover:bg-[#F9F8F6] border border-[#E5E0DA] rounded-xl transition-all cursor-pointer shadow-4xs"
            >
              <div className="flex items-center gap-2">
                <i className={`ti ${tpl.icon || 'ti-brand-nextjs'} text-base text-[#cc785c]`} />
                <span className="text-xs font-bold text-[#191919] truncate">{tpl.name}</span>
              </div>
              <p className="text-[9px] text-[#5E5B56] line-clamp-2 mt-2 leading-relaxed">{tpl.description}</p>
              <div className="flex flex-wrap gap-1 mt-3">
                {tpl.stack.slice(0, 2).map((s) => (
                  <span key={s} className="text-[8px] bg-[#F4F0EB] text-[#5E5B56] px-1.5 py-0.5 rounded font-medium">{s}</span>
                ))}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Past sessions */}
      <div className="space-y-3">
        <h2 className="text-xs font-bold text-[#85827D] uppercase tracking-wider">Past Coding Sessions</h2>
        {loading ? (
          <div className="text-center py-10 text-xs text-[#85827D]">
            <i className="ti ti-loader animate-spin mr-2" />
            Loading sessions history...
          </div>
        ) : sessions.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-[#E5E0DA] bg-white rounded-2xl text-xs text-[#85827D] italic">
            No coding sessions found. Launch a mode above to start.
          </div>
        ) : (
          <div className="bg-white border border-[#E5E0DA] rounded-2xl overflow-hidden shadow-3xs divide-y divide-[#F4F0EB]">
            {sessions.map((sess) => (
              <div key={sess.id} className="flex items-center justify-between p-4 hover:bg-[#F9F8F6] transition-colors">
                <div className="space-y-1 min-w-0 pr-4">
                  <h3 className="text-xs font-bold text-[#191919] truncate max-w-[480px]">
                    {sess.description}
                  </h3>
                  <div className="flex items-center gap-3 text-[10px] text-[#85827D] font-medium">
                    {getModeBadge(sess.mode)}
                    <span>Stack: {sess.language} {sess.framework ? `+ ${sess.framework}` : ''}</span>
                    <span>•</span>
                    <span>{new Date(sess.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase border ${
                    sess.status === 'complete' 
                      ? 'bg-green-50 text-green-700 border-green-200' 
                      : sess.status === 'running' 
                      ? 'bg-amber-50 text-amber-700 border-amber-200 animate-pulse'
                      : 'bg-red-50 text-red-700 border-red-200'
                  }`}>
                    {sess.status}
                  </span>
                  <button
                    onClick={() => onOpenSession(sess.id)}
                    className="bg-white hover:bg-[#F4F0EB] border border-[#E5E0DA] text-[#191919] text-xs font-bold px-3 py-1.5 rounded-full transition-all cursor-pointer shadow-4xs"
                  >
                    Open
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* BUILD MODAL CONTAINER */}
      {activeModal === 'build' && (
        <BuildInput
          projectId={projectId}
          userId={userId}
          onBuildStarted={handleSessionCreate}
          onClose={() => setActiveModal(null)}
          templates={CODE_TEMPLATES}
        />
      )}

      {/* EDIT, REVIEW, DEBUG INLINE MODALS */}
      {activeModal && activeModal !== 'build' && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in select-none">
          <div className="bg-white border border-[#E5E0DA] rounded-2xl max-w-lg w-full p-6 shadow-xl space-y-4 flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between border-b border-[#F4F0EB] pb-3 shrink-0">
              <h3 className="font-lora text-base font-bold text-[#191919] flex items-center gap-2 capitalize">
                <i className={`ti ${activeModal === 'edit' ? 'ti-edit' : activeModal === 'review' ? 'ti-shield' : 'ti-bug'} text-base text-[#cc785c]`} />
                {activeModal === 'edit' ? 'Refactor Code' : activeModal === 'review' ? 'Audit Code quality' : 'Debug Code errors'}
              </h3>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="text-[#85827D] hover:text-[#191919] transition-colors p-1 cursor-pointer"
              >
                <i className="ti ti-x text-sm" />
              </button>
            </div>

            <form onSubmit={handleSubmitModal} className="flex-1 overflow-y-auto space-y-4 pr-1">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-[#85827D] uppercase">Select language</label>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="w-full text-xs border border-[#E5E0DA] rounded-lg p-2.5 bg-[#FFFFFF] outline-none text-[#191919]"
                >
                  <option value="typescript">TypeScript</option>
                  <option value="javascript">JavaScript</option>
                  <option value="python">Python</option>
                  <option value="rust">Rust</option>
                  <option value="go">Go</option>
                  <option value="html">HTML / CSS</option>
                  <option value="sql">SQL</option>
                </select>
              </div>

              {activeModal === 'debug' && (
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-[#85827D] uppercase">Error message / Logs</label>
                  <input
                    type="text"
                    placeholder="ReferenceError: x is not defined..."
                    value={errorMessage}
                    onChange={(e) => setErrorMessage(e.target.value)}
                    className="w-full text-xs border border-[#E5E0DA] rounded-lg p-2.5 bg-[#FFFFFF] outline-none text-[#191919]"
                    required
                  />
                </div>
              )}

              {activeModal === 'edit' && (
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-[#85827D] uppercase">Refactoring Instructions</label>
                  <input
                    type="text"
                    placeholder="Convert this function to async/await, or optimize database queries..."
                    value={instruction}
                    onChange={(e) => setInstruction(e.target.value)}
                    className="w-full text-xs border border-[#E5E0DA] rounded-lg p-2.5 bg-[#FFFFFF] outline-none text-[#191919]"
                    required
                  />
                </div>
              )}

              <div className="space-y-1 flex-1 flex flex-col min-h-[160px]">
                <label className="text-[10px] font-bold text-[#85827D] uppercase">Paste code block</label>
                <textarea
                  rows={6}
                  placeholder="Paste your source code block here..."
                  value={pasteCode}
                  onChange={(e) => setPasteCode(e.target.value)}
                  className="w-full flex-1 text-xs font-mono border border-[#E5E0DA] rounded-xl p-3 bg-[#FFFFFF] outline-none text-[#191919] resize-none"
                  required
                />
              </div>

              {error && (
                <div className="text-[10px] text-red-600 bg-red-50 p-2.5 rounded border border-red-100 leading-relaxed">
                  {error}
                </div>
              )}

              <div className="flex gap-2.5 pt-3 border-t border-[#F4F0EB] shrink-0">
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="flex-1 bg-white hover:bg-[#F9F8F6] border border-[#E5E0DA] text-[#191919] text-xs py-2 rounded-full font-medium transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 flex items-center justify-center gap-1.5 bg-[#cc785c] hover:bg-[#a9583e] text-white text-xs py-2 rounded-full font-semibold transition-colors disabled:opacity-50 cursor-pointer shadow-2xs"
                >
                  {isSubmitting ? (
                    <>
                      <i className="ti ti-loader animate-spin" />
                      <span>Processing...</span>
                    </>
                  ) : (
                    <>
                      <span>Submit</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
