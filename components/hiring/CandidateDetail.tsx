'use client';

import React, { useState, useEffect } from 'react';
import { 
  X, Mail, Calendar, Sparkles, CheckCircle2, AlertTriangle, 
  MapPin, Briefcase, Award, Send, Ban, RefreshCw, PlusCircle
} from 'lucide-react';

interface Candidate {
  id: string;
  job_id: string;
  name: string;
  email: string | null;
  linkedin_url: string | null;
  resume_url: string | null;
  resume_text: string | null;
  source: 'linkedin' | 'naukri' | 'manual' | 'referral';
  match_score: number | null;
  score_breakdown: Record<string, any> | null;
  status: 'new' | 'screening' | 'interview' | 'assessment' | 'offer' | 'rejected' | 'hired';
  notes: string | null;
  created_at: string;
}

interface Interview {
  id: string;
  scheduled_at: string;
  duration_mins: number;
  interview_type: 'screening' | 'technical' | 'cultural' | 'final';
  questions: Array<{ question: string; area: string; ideal_answer: string }>;
  assessment: string | null;
  outcome: string | null;
}

interface CandidateEmail {
  id: string;
  email_type: 'invite' | 'rejection' | 'followup' | 'offer';
  subject: string;
  body: string;
  sent_at: string;
}

interface CandidateDetailProps {
  candidateId: string;
  onClose: () => void;
  onStatusChange: () => void;
}

export default function CandidateDetail({ candidateId, onClose, onStatusChange }: CandidateDetailProps) {
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [emails, setEmails] = useState<CandidateEmail[]>([]);
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [loading, setLoading] = useState(true);

  // Scheduling State
  const [scheduledAt, setScheduledAt] = useState('');
  const [interviewType, setInterviewType] = useState('technical');
  const [scheduling, setScheduling] = useState(false);

  // Assessment State
  const [selectedInterviewId, setSelectedInterviewId] = useState('');
  const [notes, setNotes] = useState('');
  const [assessing, setAssessing] = useState(false);

  // Action Loading states
  const [sendingInvite, setSendingInvite] = useState(false);
  const [sendingReject, setSendingReject] = useState(false);

  const fetchDetails = async () => {
    try {
      const res = await fetch(`/api/hiring/candidates?candidateId=${candidateId}`);
      const data = await res.json();
      if (data.success) {
        setCandidate(data.candidate);
        setEmails(data.emails || []);
        setInterviews(data.interviews || []);
        if (data.interviews?.length > 0) {
          setSelectedInterviewId(data.interviews[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to load candidate details:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetails();
  }, [candidateId]);

  const handleSendInvite = async () => {
    setSendingInvite(true);
    try {
      const res = await fetch('/api/hiring/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidateId })
      });
      const data = await res.json();
      if (data.success) {
        fetchDetails();
        onStatusChange();
      }
    } catch (err) {
      console.error('Failed to send invite email:', err);
    } finally {
      setSendingInvite(false);
    }
  };

  const handleSendReject = async () => {
    setSendingReject(true);
    try {
      const res = await fetch('/api/hiring/reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidateId })
      });
      const data = await res.json();
      if (data.success) {
        fetchDetails();
        onStatusChange();
      }
    } catch (err) {
      console.error('Failed to send rejection email:', err);
    } finally {
      setSendingReject(false);
    }
  };

  const handleSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scheduledAt) return;
    setScheduling(true);
    try {
      const res = await fetch('/api/hiring/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidateId,
          scheduledAt,
          type: interviewType
        })
      });
      const data = await res.json();
      if (data.success) {
        setScheduledAt('');
        fetchDetails();
        onStatusChange();
      }
    } catch (err) {
      console.error('Failed to schedule interview:', err);
    } finally {
      setScheduling(false);
    }
  };

  const handleAssess = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInterviewId || !notes) return;
    setAssessing(true);
    try {
      const res = await fetch('/api/hiring/assess', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          interviewId: selectedInterviewId,
          notes
        })
      });
      const data = await res.json();
      if (data.success) {
        setNotes('');
        fetchDetails();
        onStatusChange();
      }
    } catch (err) {
      console.error('Failed to submit assessment:', err);
    } finally {
      setAssessing(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-[#141413]/40 backdrop-blur-xs flex items-center justify-center z-50 p-4 font-dmsans">
        <div className="w-16 h-16 rounded-full bg-white flex items-center justify-center shadow-md">
          <span className="w-6 h-6 border-2 border-[#cc785c] border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (!candidate) return null;

  const scoreData = candidate.score_breakdown || {};
  const redFlags = scoreData.red_flags || [];

  return (
    <div className="fixed inset-0 bg-[#141413]/40 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fadeIn select-none font-dmsans">
      <div className="w-full max-w-4xl bg-[#FFFFFF] border border-[#E5E0DA] rounded-2xl shadow-lg flex flex-col overflow-hidden max-h-[90vh] animate-slideUp text-left">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 border-b border-hairline bg-[#FAF9F5]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-surface-cream-strong flex items-center justify-center font-lora text-md font-bold text-ink">
              {candidate.name.split(' ').map(n=>n[0]).join('').toUpperCase()}
            </div>
            <div>
              <h2 className="font-serif text-md font-normal text-ink">{candidate.name}</h2>
              <p className="text-[10px] text-muted-soft tracking-tight">Source: {candidate.source.toUpperCase()} • {candidate.email || 'No Email'}</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1 hover:bg-surface-cream-strong rounded text-muted hover:text-ink transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Column 1: Candidate Profile & Fit Score Card */}
          <div className="space-y-6 md:col-span-1">
            {/* Scorecard */}
            <div className="bg-surface-soft/40 border border-hairline rounded-xl p-5 space-y-4">
              <div className="text-center">
                <span className="text-[9px] font-extrabold uppercase tracking-wider text-muted-soft">Match Score Rating</span>
                <div className="font-serif text-3xl font-bold text-[#cc785c] mt-1">
                  {candidate.match_score ?? 'N/A'}%
                </div>
                <span className="text-[10px] font-semibold text-muted bg-[#cc785c]/10 border border-[#cc785c]/10 px-2 py-0.2 rounded-full mt-1.5 inline-block uppercase tracking-wide">
                  {scoreData.recommendation || 'Scored'}
                </span>
              </div>

              {/* Dimensions */}
              {candidate.match_score && (
                <div className="space-y-2.5 pt-4 border-t border-hairline text-[10px]">
                  <div className="flex justify-between items-center text-muted font-bold">
                    <span>Technical Match:</span>
                    <span className="text-ink">{scoreData.technical}%</span>
                  </div>
                  <div className="w-full bg-[#E5E0DA] h-1.5 rounded-full overflow-hidden">
                    <div className="bg-[#cc785c] h-full rounded-full" style={{ width: `${scoreData.technical}%` }} />
                  </div>

                  <div className="flex justify-between items-center text-muted font-bold">
                    <span>Experience Fit:</span>
                    <span className="text-ink">{scoreData.experience}%</span>
                  </div>
                  <div className="w-full bg-[#E5E0DA] h-1.5 rounded-full overflow-hidden">
                    <div className="bg-[#5db8a6] h-full rounded-full" style={{ width: `${scoreData.experience}%` }} />
                  </div>

                  <div className="flex justify-between items-center text-muted font-bold">
                    <span>Location/Avail:</span>
                    <span className="text-ink">{scoreData.location}%</span>
                  </div>
                  <div className="w-full bg-[#E5E0DA] h-1.5 rounded-full overflow-hidden">
                    <div className="bg-[#e8a55a] h-full rounded-full" style={{ width: `${scoreData.location}%` }} />
                  </div>
                </div>
              )}
            </div>

            {/* Red Flags / Warnings */}
            {redFlags.length > 0 && (
              <div className="bg-red-50/50 border border-red-200 rounded-xl p-4 space-y-2 text-[10px]">
                <div className="flex items-center gap-1.5 text-red-700 font-extrabold uppercase tracking-wider">
                  <AlertTriangle className="w-4 h-4 text-red-600" />
                  <span>Research Signals Alert</span>
                </div>
                <ul className="space-y-1 text-red-600 font-medium list-disc pl-3 leading-normal">
                  {redFlags.map((flag: string, idx: number) => (
                    <li key={idx}>{flag}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Resume Text Summary block */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-soft">Background Summary</span>
              <div className="border border-hairline rounded-xl p-3 bg-[#FFFFFF] text-[10px] text-body leading-relaxed max-h-[160px] overflow-y-auto font-inter">
                {candidate.resume_text || 'No resume data parsed.'}
              </div>
            </div>
          </div>

          {/* Column 2 & 3: Tabs & Execution Actions */}
          <div className="space-y-6 md:col-span-2 flex flex-col justify-between">
            <div className="space-y-6">
              
              {/* Emails Dispatch Area */}
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-hairline pb-2">
                  <span className="text-xs font-bold text-ink uppercase tracking-wider flex items-center gap-1.5">
                    <Mail className="w-4 h-4 text-muted-soft" />
                    <span>Candidate Email Logs</span>
                  </span>
                  
                  {candidate.status !== 'rejected' && candidate.status !== 'offer' && candidate.status !== 'hired' && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleSendReject}
                        disabled={sendingReject}
                        className="flex items-center gap-1 px-2.5 py-1 border border-red-200 hover:bg-red-50 text-red-600 rounded-lg text-[10px] font-semibold cursor-pointer disabled:opacity-50"
                      >
                        <Ban className="w-3 h-3" />
                        <span>Send Rejection</span>
                      </button>
                      <button
                        onClick={handleSendInvite}
                        disabled={sendingInvite}
                        className="flex items-center gap-1 px-2.5 py-1 bg-[#cc785c] hover:bg-[#a9583e] text-white rounded-lg text-[10px] font-bold cursor-pointer shadow-3xs disabled:opacity-50"
                      >
                        <Send className="w-3 h-3 fill-white" />
                        <span>Send Invite</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Email Logs List */}
                <div className="space-y-2 max-h-[140px] overflow-y-auto">
                  {emails.map((e) => (
                    <div key={e.id} className="border border-hairline bg-surface-soft/10 rounded-lg p-3 text-[10px] text-body">
                      <div className="flex justify-between items-center font-bold text-ink border-b border-hairline/40 pb-1.5 mb-1.5">
                        <span className="capitalize">{e.email_type} Email Sent</span>
                        <span className="text-muted-soft font-normal">{new Date(e.sent_at).toLocaleString()}</span>
                      </div>
                      <div className="font-semibold text-[#cc785c] mb-1">Subject: {e.subject}</div>
                      <div className="text-muted-soft leading-relaxed line-clamp-3 font-inter whitespace-pre-wrap">{e.body}</div>
                    </div>
                  ))}

                  {emails.length === 0 && (
                    <div className="text-center py-6 text-[10px] text-muted-soft italic">No emails dispatched. Click Send Invite above.</div>
                  )}
                </div>
              </div>

              {/* Interviews Scheduling Area */}
              <div className="space-y-3 pt-2">
                <span className="text-xs font-bold text-ink uppercase tracking-wider flex items-center gap-1.5 border-b border-hairline pb-2">
                  <Calendar className="w-4 h-4 text-muted-soft" />
                  <span>Interview Coordination</span>
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Schedule form */}
                  <form onSubmit={handleSchedule} className="bg-surface-soft/30 border border-hairline rounded-xl p-4 space-y-3">
                    <div className="text-[9px] font-extrabold uppercase tracking-wider text-muted-soft">Book Calendar Event</div>
                    
                    <div className="space-y-1">
                      <label className="text-[8px] font-bold uppercase tracking-wider text-muted-soft">Interview Type</label>
                      <select
                        value={interviewType}
                        onChange={(e) => setInterviewType(e.target.value)}
                        disabled={scheduling}
                        className="w-full bg-[#FFFFFF] border border-[#E5E0DA] rounded-lg px-2.5 py-1.5 text-[10px] text-ink cursor-pointer"
                      >
                        <option value="screening">Screening</option>
                        <option value="technical">Technical</option>
                        <option value="cultural">Cultural</option>
                        <option value="final">Final Round</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[8px] font-bold uppercase tracking-wider text-muted-soft">Schedule Time</label>
                      <input
                        type="datetime-local"
                        value={scheduledAt}
                        onChange={(e) => setScheduledAt(e.target.value)}
                        disabled={scheduling}
                        className="w-full bg-[#FFFFFF] border border-[#E5E0DA] rounded-lg px-2.5 py-1.5 text-[10px] text-ink cursor-pointer"
                        required
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={scheduling}
                      className="w-full py-1.5 bg-[#cc785c] hover:bg-[#a9583e] text-white rounded-lg text-[10px] font-bold transition-all shadow-3xs cursor-pointer flex items-center justify-center gap-1"
                    >
                      {scheduling ? <RefreshCw className="w-3 h-3 animate-spin" /> : <PlusCircle className="w-3.5 h-3.5" />}
                      <span>{scheduling ? 'Booking...' : 'Schedule Event'}</span>
                    </button>
                  </form>

                  {/* Interviews scheduled list */}
                  <div className="space-y-2 max-h-[180px] overflow-y-auto">
                    {interviews.map((int) => (
                      <div key={int.id} className="border border-hairline rounded-xl p-3 text-[10px] bg-white">
                        <div className="flex justify-between items-center font-bold text-ink border-b border-hairline/40 pb-1.5 mb-1.5">
                          <span className="uppercase tracking-wider text-[#cc785c]">{int.interview_type} Interview</span>
                          <span className={`px-1.5 py-0.2 rounded-full border text-[8px] ${
                            int.outcome ? 'bg-green-50 text-green-700 border-green-200' : 'bg-amber-50 text-amber-700 border-amber-200'
                          }`}>
                            {int.outcome ? 'Evaluated' : 'Scheduled'}
                          </span>
                        </div>
                        <div className="text-muted-soft">Time: {new Date(int.scheduled_at).toLocaleString()}</div>

                        {/* Questions list toggle mock */}
                        {int.questions?.length > 0 && (
                          <div className="mt-2 pt-2 border-t border-hairline/40 text-[9px] text-muted space-y-1">
                            <div className="font-bold text-ink uppercase tracking-wider">Scored Questions:</div>
                            {int.questions.map((q, qIdx) => (
                              <div key={qIdx} className="truncate">
                                • <span className="font-semibold text-body">{q.question}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}

                    {interviews.length === 0 && (
                      <div className="text-center py-10 text-[10px] text-muted-soft italic bg-surface-soft/10 border border-dashed border-hairline rounded-xl h-full flex flex-col items-center justify-center">
                        No scheduled interviews.
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Assessment compiler view */}
              {interviews.length > 0 && (
                <div className="space-y-3 pt-2">
                  <span className="text-xs font-bold text-ink uppercase tracking-wider flex items-center gap-1.5 border-b border-hairline pb-2">
                    <CheckCircle2 className="w-4 h-4 text-muted-soft" />
                    <span>Log Interview Feedback & Score</span>
                  </span>

                  <form onSubmit={handleAssess} className="bg-surface-soft/30 border border-hairline rounded-xl p-4 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[8px] font-bold uppercase tracking-wider text-muted-soft">Select Interview Round</label>
                        <select
                          value={selectedInterviewId}
                          onChange={(e) => setSelectedInterviewId(e.target.value)}
                          disabled={assessing}
                          className="w-full bg-[#FFFFFF] border border-[#E5E0DA] rounded-lg px-2.5 py-1.5 text-[10px] text-ink cursor-pointer"
                        >
                          {interviews.map(i => (
                            <option key={i.id} value={i.id}>
                              {i.interview_type.toUpperCase()} ({new Date(i.scheduled_at).toLocaleDateString()})
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[8px] font-bold uppercase tracking-wider text-muted-soft">Interviewer Assessment Notes</label>
                      <textarea
                        placeholder="e.g. Strong technical coding skills, explained system architecture tradeoffs accurately. Weakness in UI layout CSS."
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        disabled={assessing}
                        rows={3}
                        className="w-full bg-[#FFFFFF] border border-[#E5E0DA] rounded-lg px-3 py-1.5 text-[10px] text-ink focus:outline-none placeholder-muted-soft resize-none font-inter"
                        required
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={assessing}
                      className="w-full py-1.5 bg-[#cc785c] hover:bg-[#a9583e] text-white rounded-lg text-[10px] font-bold transition-all shadow-3xs cursor-pointer flex items-center justify-center gap-1"
                    >
                      {assessing ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                      <span>{assessing ? 'Compiling Assessment...' : 'Synthesize Assessment'}</span>
                    </button>
                  </form>
                </div>
              )}

            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
