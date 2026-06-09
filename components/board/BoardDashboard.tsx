'use client';

import React, { useState, useEffect } from 'react';
import BoardMemberCard from './BoardMemberCard';
import BoardMeetingView from './BoardMeetingView';
import BoardResolutions from './BoardResolutions';
import InvestorUpdate from './InvestorUpdate';
import { StartupAgent } from '../../types';
import { Users, UsersRound, FileSignature, MailCheck, RefreshCw } from 'lucide-react';

interface BoardDashboardProps {
  projectId: string;
  userId: string;
}

export default function BoardDashboard({ projectId, userId }: BoardDashboardProps) {
  const [activeTab, setActiveTab] = useState<'directors' | 'meeting' | 'resolutions' | 'updates'>('directors');
  const [directors, setDirectors] = useState<StartupAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [meetingMinutes, setMeetingMinutes] = useState('');
  const [resolutionRefreshKey, setResolutionRefreshKey] = useState(0);

  const fetchDirectors = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/startup-agents/list?projectId=${projectId}`);
      const data = await res.json();
      if (data.agents) {
        setDirectors(data.agents);
      }
    } catch (err) {
      console.error('Failed to fetch board directors:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDirectors();
  }, [projectId]);

  const handleMinutesGenerated = (minutes: string) => {
    setMeetingMinutes(minutes);
  };

  const handleResolutionProposed = () => {
    // Increment the key to trigger a refetch in the Resolutions component
    setResolutionRefreshKey((prev) => prev + 1);
  };

  return (
    <div className="h-full flex flex-col overflow-hidden bg-canvas font-dmsans">
      {/* Tab Switcher Headers */}
      <div className="px-6 border-b border-hairline bg-surface-soft/40 flex items-center justify-between shrink-0">
        <div className="flex gap-4">
          <button
            onClick={() => setActiveTab('directors')}
            className={`py-3 px-1 text-xs font-bold uppercase tracking-wider border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'directors'
                ? 'border-[#cc785c] text-[#cc785c]'
                : 'border-transparent text-muted hover:text-ink'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>AI Directors ({directors.length})</span>
          </button>
          
          <button
            onClick={() => setActiveTab('meeting')}
            className={`py-3 px-1 text-xs font-bold uppercase tracking-wider border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'meeting'
                ? 'border-[#cc785c] text-[#cc785c]'
                : 'border-transparent text-muted hover:text-ink'
            }`}
          >
            <UsersRound className="w-4 h-4" />
            <span>Boardroom Simulator</span>
          </button>

          <button
            onClick={() => setActiveTab('resolutions')}
            className={`py-3 px-1 text-xs font-bold uppercase tracking-wider border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'resolutions'
                ? 'border-[#cc785c] text-[#cc785c]'
                : 'border-transparent text-muted hover:text-ink'
            }`}
          >
            <FileSignature className="w-4 h-4" />
            <span>Proposed Resolutions</span>
          </button>

          <button
            onClick={() => setActiveTab('updates')}
            className={`py-3 px-1 text-xs font-bold uppercase tracking-wider border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'updates'
                ? 'border-[#cc785c] text-[#cc785c]'
                : 'border-transparent text-muted hover:text-ink'
            }`}
          >
            <MailCheck className="w-4 h-4" />
            <span>Investor Updates</span>
          </button>
        </div>

        {activeTab === 'directors' && (
          <button
            onClick={fetchDirectors}
            className="p-1 hover:bg-surface-cream-strong rounded text-muted hover:text-ink transition-colors cursor-pointer"
            title="Refresh Directors List"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Main viewport area */}
      <div className="flex-1 overflow-y-auto p-6">
        {activeTab === 'directors' && (
          <div>
            {loading ? (
              <div className="flex flex-col items-center justify-center py-24">
                <span className="w-8 h-8 border-4 border-[#cc785c] border-t-transparent rounded-full animate-spin" />
                <span className="text-xs text-muted-soft mt-2.5">Aligning AI Board Seats...</span>
              </div>
            ) : directors.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-slideUp">
                {directors.map((member) => (
                  <BoardMemberCard key={member.id} member={member} />
                ))}
              </div>
            ) : (
              <div className="text-center py-16 border border-dashed border-hairline rounded-2xl max-w-sm mx-auto p-6 space-y-4">
                <Users className="w-8 h-8 text-[#cc785c] mx-auto" />
                <div className="space-y-1">
                  <h3 className="font-serif text-lg text-ink font-normal">Directors Not Set</h3>
                  <p className="text-xs text-muted-soft leading-normal">
                    This project does not have any AI Directors active. Deploy AI agents under Startup CommandCenter first to convene board alignment.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'meeting' && (
          <div className="max-w-4xl mx-auto animate-slideUp">
            <BoardMeetingView
              projectId={projectId}
              onMinutesGenerated={handleMinutesGenerated}
              onResolutionProposed={handleResolutionProposed}
            />
          </div>
        )}

        {activeTab === 'resolutions' && (
          <div className="max-w-3xl mx-auto animate-slideUp">
            <BoardResolutions
              projectId={projectId}
              refreshKey={resolutionRefreshKey}
            />
          </div>
        )}

        {activeTab === 'updates' && (
          <div className="max-w-4xl mx-auto animate-slideUp">
            <InvestorUpdate projectId={projectId} />
          </div>
        )}
      </div>
    </div>
  );
}
