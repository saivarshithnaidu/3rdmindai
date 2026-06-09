'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface GitHubPanelProps {
  sessionId: string;
  projectId: string;
  userId?: string;
  onPushSuccess?: (prUrl: string) => void;
}

export default function GitHubPanel({
  sessionId,
  projectId,
  userId = '00000000-0000-0000-0000-000000000000',
  onPushSuccess
}: GitHubPanelProps) {
  const router = useRouter();
  const [isConnected, setIsConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  
  // Form fields
  const [repos, setRepos] = useState<string[]>([]);
  const [selectedRepo, setSelectedRepo] = useState('');
  const [branch, setBranch] = useState('feature/3rdmind');
  const [commitMessage, setCommitMessage] = useState('feat: coding session updates');
  
  // Actions states
  const [isPushing, setIsPushing] = useState(false);
  const [prUrl, setPrUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Modal / pull states
  const [showPullModal, setShowPullModal] = useState(false);
  const [pullRepoUrl, setPullRepoUrl] = useState('');
  const [pullBranch, setPullBranch] = useState('main');
  const [isPulling, setIsPulling] = useState(false);

  useEffect(() => {
    // Check connector list
    setLoading(true);
    fetch(`/api/connectors/list?userId=${userId}`)
      .then(res => res.json())
      .then(data => {
        if (data && Array.isArray(data.connectors)) {
          const githubConn = data.connectors.find((c: any) => c.slug === 'github');
          if (githubConn && githubConn.isConnected) {
            setIsConnected(true);
            // Mock or fetch some repositories
            // In a real OAuth flow we can call the GitHub API or MCP list_repos,
            // here we provide a sensible default list + user input!
            setRepos([
              'saivarshithnaidu/3rdmindai',
              'saivarshithnaidu/saas-dashboard',
              'saivarshithnaidu/express-auth-boilerplate'
            ]);
            setSelectedRepo('saivarshithnaidu/3rdmindai');
          }
        }
      })
      .catch(err => {
        console.error('Failed to query connectors list:', err);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [userId]);

  const handlePush = async () => {
    setIsPushing(true);
    setError(null);
    setPrUrl(null);
    try {
      const res = await fetch('/api/coding/github', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          repo: selectedRepo,
          branch,
          message: commitMessage,
          userId
        })
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Failed to push to GitHub');
      }

      setPrUrl(data.prUrl);
      if (onPushSuccess && data.prUrl) {
        onPushSuccess(data.prUrl);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsPushing(false);
    }
  };

  const handlePull = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pullRepoUrl) return;
    
    setIsPulling(true);
    setError(null);
    try {
      const res = await fetch('/api/coding/github/pull', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repoUrl: pullRepoUrl,
          branch: pullBranch,
          projectId,
          userId
        })
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Failed to pull repository');
      }

      // Redirect to new session
      setShowPullModal(false);
      router.push(`/coding?projectId=${projectId}&sessionId=${data.sessionId}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsPulling(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-6 text-xs text-[#85827D] font-dmsans">
        <i className="ti ti-loader animate-spin mr-2" />
        Checking GitHub authorization...
      </div>
    );
  }

  return (
    <div className="space-y-4 font-dmsans">
      {!isConnected ? (
        <div className="bg-white border border-[#E5E0DA] rounded-xl p-4 text-center space-y-3 shadow-3xs">
          <i className="ti ti-brand-github text-3xl text-[#191919]" />
          <h4 className="text-xs font-bold text-[#191919]">GitHub Connection Required</h4>
          <p className="text-[10px] text-[#5E5B56] leading-relaxed">
            Connect your GitHub account to enable code checkouts, branching, commits, and pull requests directly.
          </p>
          <button
            onClick={() => router.push('/connectors')}
            className="w-full flex items-center justify-center gap-1.5 bg-[#191919] hover:bg-[#2d2d2d] text-white text-xs py-2 rounded-full font-medium transition-colors cursor-pointer shadow-sm"
          >
            <i className="ti ti-plug-connected text-xs" />
            <span>Connect GitHub</span>
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-white border border-[#E5E0DA] rounded-xl p-4 space-y-3.5 shadow-3xs">
            <div className="flex items-center justify-between border-b border-[#F4F0EB] pb-2">
              <span className="text-xs font-bold text-[#191919] flex items-center gap-1.5">
                <i className="ti ti-brand-github text-sm" />
                Push to GitHub
              </span>
              <span className="text-[9px] font-bold text-green-600 bg-green-50 border border-green-200/50 px-1.5 py-0.5 rounded-full uppercase">
                Connected
              </span>
            </div>

            {/* Repo Input */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-[#85827D] uppercase">Select Repository</label>
              <div className="relative">
                <select
                  value={selectedRepo}
                  onChange={(e) => setSelectedRepo(e.target.value)}
                  className="w-full text-xs border border-[#E5E0DA] rounded-lg p-2 bg-[#FFFFFF] outline-none text-[#191919] appearance-none"
                >
                  {repos.map(r => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
                <div className="absolute right-2 top-2.5 pointer-events-none text-[#5E5B56]">
                  <i className="ti ti-selector text-xs" />
                </div>
              </div>
            </div>

            {/* Custom entry if user wants */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-[#85827D] uppercase">Or type repository path</label>
              <input
                type="text"
                placeholder="owner/repo"
                value={selectedRepo}
                onChange={(e) => setSelectedRepo(e.target.value)}
                className="w-full text-xs border border-[#E5E0DA] rounded-lg p-2 bg-[#FFFFFF] outline-none text-[#191919]"
              />
            </div>

            {/* Branch */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-[#85827D] uppercase">Target Branch</label>
              <input
                type="text"
                placeholder="feature/3rdmind"
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
                className="w-full text-xs border border-[#E5E0DA] rounded-lg p-2 bg-[#FFFFFF] outline-none text-[#191919]"
              />
            </div>

            {/* Commit Message */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-[#85827D] uppercase">Commit Message</label>
              <textarea
                rows={2}
                placeholder="feat: add code..."
                value={commitMessage}
                onChange={(e) => setCommitMessage(e.target.value)}
                className="w-full text-xs border border-[#E5E0DA] rounded-lg p-2 bg-[#FFFFFF] outline-none text-[#191919] resize-none"
              />
            </div>

            {error && (
              <div className="text-[10px] text-red-600 bg-red-50 p-2.5 rounded border border-red-100 leading-relaxed">
                {error}
              </div>
            )}

            {prUrl && (
              <div className="text-[10px] text-green-700 bg-green-50 p-2.5 rounded border border-green-100 space-y-1.5">
                <p className="font-semibold">PR created successfully!</p>
                <a
                  href={prUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary hover:underline font-bold flex items-center gap-1"
                >
                  <span>Open Pull Request</span>
                  <i className="ti ti-external-link text-[10px]" />
                </a>
              </div>
            )}

            <button
              onClick={handlePush}
              disabled={isPushing}
              className="w-full flex items-center justify-center gap-1.5 bg-[#cc785c] hover:bg-[#a9583e] text-white text-xs py-2 rounded-full font-semibold transition-colors shadow-2xs disabled:opacity-50 cursor-pointer"
            >
              {isPushing ? (
                <>
                  <i className="ti ti-loader animate-spin text-xs" />
                  <span>Pushing files...</span>
                </>
              ) : (
                <>
                  <i className="ti ti-git-pull-request text-xs" />
                  <span>Push to GitHub</span>
                </>
              )}
            </button>
          </div>

          <div className="bg-[#FFFFFF] border border-[#E5E0DA] rounded-xl p-4 text-center shadow-3xs space-y-2">
            <h5 className="text-xs font-bold text-[#191919]">Need to import existing code?</h5>
            <p className="text-[10px] text-[#5E5B56] leading-relaxed">
              Pull an existing GitHub repository. The Coding Agent will read it and adapt code accordingly.
            </p>
            <button
              onClick={() => setShowPullModal(true)}
              className="w-full flex items-center justify-center gap-1.5 bg-white border border-[#E5E0DA] hover:bg-[#F9F8F6] text-[#191919] text-xs py-1.5 rounded-full font-medium transition-colors cursor-pointer"
            >
              <i className="ti ti-download text-xs text-[#85827D]" />
              <span>Pull from GitHub</span>
            </button>
          </div>
        </div>
      )}

      {/* Pull Modal */}
      {showPullModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white border border-[#E5E0DA] rounded-2xl max-w-sm w-full p-6 shadow-xl space-y-4 animate-scale-up">
            <div className="flex items-center justify-between border-b border-[#F4F0EB] pb-3">
              <h3 className="font-lora text-sm font-bold text-[#191919] flex items-center gap-2">
                <i className="ti ti-download text-base text-[#cc785c]" />
                Pull Repository
              </h3>
              <button
                type="button"
                onClick={() => setShowPullModal(false)}
                className="text-[#85827D] hover:text-[#191919] transition-colors p-1 cursor-pointer"
              >
                <i className="ti ti-x text-sm" />
              </button>
            </div>

            <form onSubmit={handlePull} className="space-y-3.5">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-[#85827D] uppercase">Repository URL</label>
                <input
                  type="url"
                  placeholder="https://github.com/owner/repo"
                  value={pullRepoUrl}
                  onChange={(e) => setPullRepoUrl(e.target.value)}
                  className="w-full text-xs border border-[#E5E0DA] rounded-lg p-2.5 bg-[#FFFFFF] outline-none text-[#191919]"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-[#85827D] uppercase">Branch</label>
                <input
                  type="text"
                  placeholder="main"
                  value={pullBranch}
                  onChange={(e) => setPullBranch(e.target.value)}
                  className="w-full text-xs border border-[#E5E0DA] rounded-lg p-2.5 bg-[#FFFFFF] outline-none text-[#191919]"
                  required
                />
              </div>

              <div className="flex gap-2.5 pt-3">
                <button
                  type="button"
                  onClick={() => setShowPullModal(false)}
                  className="flex-1 bg-white hover:bg-[#F9F8F6] border border-[#E5E0DA] text-[#191919] text-xs py-2 rounded-full font-medium transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPulling}
                  className="flex-1 flex items-center justify-center gap-1.5 bg-[#191919] hover:bg-[#2d2d2d] text-white text-xs py-2 rounded-full font-semibold transition-colors disabled:opacity-50 cursor-pointer shadow-sm"
                >
                  {isPulling ? (
                    <>
                      <i className="ti ti-loader animate-spin" />
                      <span>Pulling...</span>
                    </>
                  ) : (
                    <>
                      <i className="ti ti-download" />
                      <span>Start Pull</span>
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
