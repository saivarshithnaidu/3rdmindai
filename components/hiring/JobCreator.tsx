'use client';

import React, { useState } from 'react';
import { X, Sparkles } from 'lucide-react';

interface JobCreatorProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  onSuccess: (job: any) => void;
}

export default function JobCreator({ isOpen, onClose, projectId, onSuccess }: JobCreatorProps) {
  const [title, setTitle] = useState('');
  const [department, setDepartment] = useState('');
  const [location, setLocation] = useState('');
  const [workType, setWorkType] = useState('remote');
  const [salaryMin, setSalaryMin] = useState('');
  const [salaryMax, setSalaryMax] = useState('');
  const [currency, setCurrency] = useState('INR');
  const [requirements, setRequirements] = useState('');
  const [niceToHave, setNiceToHave] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !department || !location || !requirements) {
      setError('Title, Department, Location and Requirements are required');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // 1. Create the job posting
      const res = await fetch('/api/hiring/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          title,
          department,
          location,
          workType,
          salaryMin: salaryMin ? parseInt(salaryMin) : null,
          salaryMax: salaryMax ? parseInt(salaryMax) : null,
          currency,
          requirements,
          niceToHave
        })
      });
      const data = await res.json();
      
      if (data.success && data.job) {
        // 2. Generate JD description text via AI
        try {
          const jdRes = await fetch('/api/hiring/generate-jd', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ jobId: data.job.id })
          });
          const jdData = await jdRes.json();
          if (jdData.success) {
            onSuccess({ ...data.job, jd_content: jdData.jd });
          } else {
            onSuccess(data.job);
          }
        } catch (jdErr) {
          console.warn('AI Job Description generation failed, returning draft:', jdErr);
          onSuccess(data.job);
        }
        
        // Reset states
        setTitle('');
        setDepartment('');
        setLocation('');
        setRequirements('');
        setNiceToHave('');
        setSalaryMin('');
        setSalaryMax('');
        onClose();
      } else {
        setError(data.error || 'Failed to create job posting.');
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-[#141413]/40 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fadeIn select-none font-dmsans">
      <div className="w-full max-w-lg bg-[#FFFFFF] border border-[#E5E0DA] rounded-2xl shadow-lg flex flex-col overflow-hidden max-h-[90vh] animate-slideUp text-left">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-hairline bg-[#FAF9F5]">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#cc785c]" />
            <span className="text-xs font-bold uppercase tracking-wider text-ink">Publish AI Job Opening</span>
          </div>
          <button 
            onClick={onClose}
            className="p-1 hover:bg-surface-cream-strong rounded text-muted hover:text-ink transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-[11px] text-red-700 rounded-lg font-medium">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-soft">Job Title</label>
              <input
                type="text"
                placeholder="e.g. Senior Frontend Engineer"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={loading}
                className="w-full bg-transparent border border-[#E5E0DA] focus:border-[#cc785c] rounded-xl px-3 py-2 text-xs text-ink focus:outline-none transition-all placeholder-muted-soft"
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-soft">Department</label>
              <input
                type="text"
                placeholder="e.g. Engineering, Sales"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                disabled={loading}
                className="w-full bg-transparent border border-[#E5E0DA] focus:border-[#cc785c] rounded-xl px-3 py-2 text-xs text-ink focus:outline-none transition-all placeholder-muted-soft"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-soft">Location</label>
              <input
                type="text"
                placeholder="e.g. Bangalore, San Francisco"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                disabled={loading}
                className="w-full bg-transparent border border-[#E5E0DA] focus:border-[#cc785c] rounded-xl px-3 py-2 text-xs text-ink focus:outline-none transition-all placeholder-muted-soft"
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-soft">Work Arrangement</label>
              <select
                value={workType}
                onChange={(e) => setWorkType(e.target.value)}
                disabled={loading}
                className="w-full bg-[#FFFFFF] border border-[#E5E0DA] focus:border-[#cc785c] rounded-xl px-3 py-2 text-xs text-ink focus:outline-none transition-all cursor-pointer"
              >
                <option value="remote">Remote</option>
                <option value="hybrid">Hybrid</option>
                <option value="onsite">On-Site</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-soft">Currency</label>
              <input
                type="text"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                disabled={loading}
                className="w-full bg-transparent border border-[#E5E0DA] focus:border-[#cc785c] rounded-xl px-3 py-2 text-xs text-ink focus:outline-none transition-all"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-soft">Min Salary</label>
              <input
                type="number"
                placeholder="Min"
                value={salaryMin}
                onChange={(e) => setSalaryMin(e.target.value)}
                disabled={loading}
                className="w-full bg-transparent border border-[#E5E0DA] focus:border-[#cc785c] rounded-xl px-3 py-2 text-xs text-ink focus:outline-none transition-all placeholder-muted-soft"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-soft">Max Salary</label>
              <input
                type="number"
                placeholder="Max"
                value={salaryMax}
                onChange={(e) => setSalaryMax(e.target.value)}
                disabled={loading}
                className="w-full bg-transparent border border-[#E5E0DA] focus:border-[#cc785c] rounded-xl px-3 py-2 text-xs text-ink focus:outline-none transition-all placeholder-muted-soft"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-soft">Key Requirements</label>
            <textarea
              placeholder="e.g. 5+ years React, TypeScript, GraphQL..."
              value={requirements}
              onChange={(e) => setRequirements(e.target.value)}
              disabled={loading}
              rows={3}
              className="w-full bg-transparent border border-[#E5E0DA] focus:border-[#cc785c] rounded-xl px-3 py-2 text-xs text-ink focus:outline-none transition-all placeholder-muted-soft resize-none"
              required
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-soft">Nice-To-Have Skills (Optional)</label>
            <textarea
              placeholder="e.g. Next.js, tailwind, micro-frontend experience..."
              value={niceToHave}
              onChange={(e) => setNiceToHave(e.target.value)}
              disabled={loading}
              rows={2}
              className="w-full bg-transparent border border-[#E5E0DA] focus:border-[#cc785c] rounded-xl px-3 py-2 text-xs text-ink focus:outline-none transition-all placeholder-muted-soft resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-hairline shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-[#E5E0DA] hover:bg-surface-soft text-xs font-semibold text-muted hover:text-ink rounded-xl transition-all cursor-pointer"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-[#cc785c] hover:bg-[#a9583e] text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              disabled={loading}
            >
              {loading ? (
                <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : null}
              <span>{loading ? 'Synthesizing JD...' : 'Publish & Generate JD'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
