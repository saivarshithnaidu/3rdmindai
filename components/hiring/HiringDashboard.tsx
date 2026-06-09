'use client';

import React, { useState, useEffect } from 'react';
import JobCreator from './JobCreator';
import CandidatePipeline from './CandidatePipeline';
import CandidateDetail from './CandidateDetail';
import LiveFeed from '../stream/LiveFeed';
import { StreamEventType } from '../../types';
import { 
  Briefcase, Plus, Sparkles, RefreshCw, Search,
  Users, CheckSquare, Settings, AlertCircle, FileText
} from 'lucide-react';

interface JobPosting {
  id: string;
  title: string;
  department: string;
  location: string;
  work_type: 'remote' | 'hybrid' | 'onsite';
  salary_min: number | null;
  salary_max: number | null;
  currency: string;
  requirements: string;
  nice_to_have: string | null;
  jd_content: string | null;
  status: 'draft' | 'active' | 'closed';
  created_at: string;
}

interface Candidate {
  id: string;
  name: string;
  email: string | null;
  linkedin_url: string | null;
  source: 'linkedin' | 'naukri' | 'manual' | 'referral';
  match_score: number | null;
  status: 'new' | 'screening' | 'interview' | 'assessment' | 'offer' | 'rejected' | 'hired';
  created_at: string;
}

interface HiringDashboardProps {
  projectId: string;
  userId: string;
}

export default function HiringDashboard({ projectId, userId }: HiringDashboardProps) {
  const [jobs, setJobs] = useState<JobPosting[]>([]);
  const [selectedJob, setSelectedJob] = useState<JobPosting | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [isCreatorOpen, setIsCreatorOpen] = useState(false);
  
  // Detail Modal State
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);

  // Sourcing & Scoring Loading States
  const [finding, setFinding] = useState(false);
  const [scoring, setScoring] = useState(false);

  const fetchJobs = async (selectJobId?: string) => {
    try {
      const res = await fetch(`/api/hiring/jobs?projectId=${projectId}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.jobs)) {
        setJobs(data.jobs);

        if (data.jobs.length > 0) {
          const defaultSelect = selectJobId
            ? data.jobs.find((j: any) => j.id === selectJobId) || data.jobs[0]
            : data.jobs[0];
          setSelectedJob(defaultSelect);
        } else {
          setSelectedJob(null);
          setCandidates([]);
        }
      }
    } catch (err) {
      console.error('Failed to fetch job postings:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchCandidates = async (jobId: string) => {
    setLoadingCandidates(true);
    try {
      const res = await fetch(`/api/hiring/candidates?jobId=${jobId}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.candidates)) {
        setCandidates(data.candidates);
      }
    } catch (err) {
      console.error('Failed to load job candidates:', err);
    } finally {
      setLoadingCandidates(false);
    }
  };

  useEffect(() => {
    fetchJobs();
  }, [projectId]);

  useEffect(() => {
    if (selectedJob) {
      fetchCandidates(selectedJob.id);
    } else {
      setCandidates([]);
    }
  }, [selectedJob]);

  const handleCreateSuccess = (newJob: JobPosting) => {
    fetchJobs(newJob.id);
  };

  const handleFindCandidates = async () => {
    if (!selectedJob) return;
    setFinding(true);
    try {
      const res = await fetch('/api/hiring/find-candidates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId: selectedJob.id,
          sources: ['linkedin', 'naukri']
        })
      });
      const data = await res.json();
      if (data.success) {
        fetchCandidates(selectedJob.id);
      }
    } catch (err) {
      console.error('Failed to scrape candidates:', err);
    } finally {
      setFinding(false);
    }
  };

  const handleScoreCandidates = async () => {
    if (!selectedJob) return;
    setScoring(true);
    try {
      const res = await fetch('/api/hiring/score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: selectedJob.id })
      });
      const data = await res.json();
      if (data.success) {
        fetchCandidates(selectedJob.id);
      }
    } catch (err) {
      console.error('Failed to score candidates:', err);
    } finally {
      setScoring(false);
    }
  };

  const handleUpdateStatus = async (candidateId: string, nextStatus: string) => {
    try {
      const res = await fetch('/api/hiring/candidates', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidateId, status: nextStatus })
      });
      const data = await res.json();
      if (data.success) {
        // Reload candidates list
        if (selectedJob) fetchCandidates(selectedJob.id);
      }
    } catch (err) {
      console.error('Failed to update candidate status:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-screen bg-canvas font-dmsans">
        <RefreshCw className="w-6 h-6 text-[#cc785c] animate-spin" />
        <span className="text-xs text-muted-soft mt-2.5">Syncing Hiring Database...</span>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col lg:flex-row h-screen bg-canvas overflow-hidden font-dmsans select-none">
      
      {/* 1. Job Openings Sidebar */}
      <div className="w-full lg:w-64 border-b lg:border-b-0 lg:border-r border-hairline bg-surface-soft/45 flex flex-col shrink-0">
        
        {/* Sidebar Header */}
        <div className="p-4 border-b border-hairline flex items-center justify-between">
          <span className="text-xs font-bold text-ink uppercase tracking-wider">Open Positions</span>
          <button
            onClick={() => setIsCreatorOpen(true)}
            className="p-1 hover:bg-surface-cream-strong rounded text-[#cc785c] hover:text-[#a9583e] transition-colors cursor-pointer"
            title="Publish Job Opening"
          >
            <Plus className="w-4.5 h-4.5" />
          </button>
        </div>

        {/* Job Listings Items */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {jobs.map((j) => {
            const isSelected = selectedJob?.id === j.id;
            return (
              <button
                key={j.id}
                onClick={() => setSelectedJob(j)}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-semibold transition-all text-left cursor-pointer ${
                  isSelected
                    ? 'bg-surface-cream-strong text-ink border-l-3 border-[#cc785c]'
                    : 'hover:bg-surface-soft text-muted hover:text-ink'
                }`}
              >
                <Briefcase className={`w-4 h-4 ${isSelected ? 'text-[#cc785c]' : 'text-muted-soft'}`} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-ink">{j.title}</div>
                  <div className="text-[10px] text-muted-soft truncate mt-0.5">{j.department} • {j.location}</div>
                </div>
              </button>
            );
          })}

          {jobs.length === 0 && (
            <div className="text-center py-8 px-4 text-xs text-muted-soft italic leading-normal">
              No openings published. Post a new opening to start.
            </div>
          )}
        </div>
      </div>

      {/* 2. Main Workspace Dashboard */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        
        {/* Top Header bar with selector actions */}
        {selectedJob ? (
          <div className="p-4 border-b border-hairline bg-canvas flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0 text-left">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-serif text-lg font-normal text-ink">
                  {selectedJob.title}
                </h2>
                <span className="text-[10px] text-muted bg-surface-soft border border-hairline px-2 py-0.5 rounded-full uppercase tracking-wider">
                  {selectedJob.department}
                </span>
                <span className="text-[10px] text-muted bg-surface-soft border border-hairline px-2 py-0.5 rounded-full uppercase tracking-wider">
                  {selectedJob.location} ({selectedJob.work_type})
                </span>
              </div>
              
              <div className="text-[10px] text-muted-soft mt-0.5 flex items-center gap-1.5 font-dmsans">
                <span>Created: {new Date(selectedJob.created_at).toLocaleDateString()}</span>
                <span>•</span>
                <span>Budget: {selectedJob.salary_min ? `${selectedJob.salary_min.toLocaleString()} - ${selectedJob.salary_max?.toLocaleString()} ${selectedJob.currency}` : 'Competitive'}</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleFindCandidates}
                disabled={finding}
                className="flex items-center gap-1 px-3 py-1.5 border border-[#E5E0DA] hover:border-[#cc785c] text-ink hover:text-[#cc785c] rounded-lg text-xs font-semibold cursor-pointer disabled:opacity-50"
              >
                {finding ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Users className="w-3.5 h-3.5" />}
                <span>{finding ? 'Scraping Profiles...' : 'Find Candidates'}</span>
              </button>
              
              {candidates.some(c => c.status === 'new') && (
                <button
                  onClick={handleScoreCandidates}
                  disabled={scoring}
                  className="flex items-center gap-1 px-3 py-1.5 bg-[#cc785c] hover:bg-[#a9583e] text-white rounded-lg text-xs font-bold cursor-pointer transition-colors shadow-2xs disabled:opacity-50"
                >
                  {scoring ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                  <span>{scoring ? 'Scoring Candidates...' : 'Score Fit Match'}</span>
                </button>
              )}
            </div>
          </div>
        ) : null}

        {/* Kanban Board viewport */}
        <div className="flex-1 overflow-y-auto p-6 bg-canvas flex flex-col justify-between">
          <div className="flex-1">
            {selectedJob ? (
              loadingCandidates ? (
                <div className="flex flex-col items-center justify-center py-24">
                  <RefreshCw className="w-6 h-6 text-[#cc785c] animate-spin" />
                  <span className="text-xs text-muted-soft mt-2.5">Syncing candidate profiles...</span>
                </div>
              ) : (
                <CandidatePipeline 
                  candidates={candidates} 
                  onSelectCandidate={(id) => setSelectedCandidateId(id)} 
                  onUpdateStatus={handleUpdateStatus} 
                />
              )
            ) : (
              // Empty State callout
              <div className="flex flex-col items-center justify-center py-24 max-w-xl mx-auto text-center space-y-6">
                
                <div className="w-16 h-16 rounded-full bg-[#cc785c]/10 flex items-center justify-center border border-[#cc785c]/20">
                  <Briefcase className="w-8 h-8 text-[#cc785c]" />
                </div>

                <div className="space-y-2">
                  <h2 className="font-serif text-2xl text-ink font-normal">AI Hiring Agent</h2>
                  <p className="text-sm text-body leading-relaxed max-w-md mx-auto font-dmsans">
                    Let AI write job descriptions, crawl LinkedIn/Naukri for candidates matching the requirements, evaluate fit match scores, and schedule interviews automatically.
                  </p>
                </div>

                <button
                  onClick={() => setIsCreatorOpen(true)}
                  className="px-6 py-2.5 bg-[#cc785c] hover:bg-[#a9583e] text-white rounded-lg text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer scale-105"
                >
                  <Plus className="w-4 h-4" />
                  <span>Publish Your First Role</span>
                </button>
              </div>
            )}
          </div>

          {/* Hiring live stream feed logs */}
          <div className="mt-8 border-t border-hairline pt-6 shrink-0">
            <h3 className="text-xs font-bold uppercase tracking-wider text-ink mb-3 text-left">Live Recruiter Agent Stream</h3>
            <LiveFeed 
              projectId={projectId} 
              filterTypes={[
                StreamEventType.AGENT_STARTED,
                StreamEventType.LEADS_SEARCHING,
                StreamEventType.LEAD_FOUND,
                StreamEventType.JUDGE_EVALUATING,
                StreamEventType.JUDGE_PASSED,
                StreamEventType.EMAIL_DRAFTING,
                StreamEventType.EMAIL_SENT,
                StreamEventType.AGENT_MESSAGE_SENT,
                StreamEventType.AGENT_TASK_QUEUED,
                StreamEventType.AGENT_COMPLETE
              ]}
              maxHeight="160px"
              compact={true}
            />
          </div>
        </div>
      </div>

      {/* Post Role Dialog modal */}
      <JobCreator 
        isOpen={isCreatorOpen} 
        onClose={() => setIsCreatorOpen(false)} 
        projectId={projectId} 
        onSuccess={handleCreateSuccess} 
      />

      {/* Candidate Profile Details dialog popover */}
      {selectedCandidateId && (
        <CandidateDetail 
          candidateId={selectedCandidateId} 
          onClose={() => setSelectedCandidateId(null)} 
          onStatusChange={() => selectedJob && fetchCandidates(selectedJob.id)} 
        />
      )}
    </div>
  );
}
