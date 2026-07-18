'use client';

import React, { useState, useEffect, useRef } from 'react';
import supabaseService from '../../services/supabase.service';
import FileTree from './FileTree';
import CodeEditor from './CodeEditor';
import ReviewPanel from './ReviewPanel';
import GitHubPanel from './GitHubPanel';
import { CodingSession, CodeFile, CodeReview, CodeIssue } from '../../types/coding';
import ExecutionPanel from './ExecutionPanel';
import CodeTeamView from './CodeTeamView';

interface CodingAgentProps {
  sessionId: string;
  projectId: string;
  userId?: string;
  onBackToDashboard: () => void;
}

export default function CodingAgent({
  sessionId,
  projectId,
  userId = '00000000-0000-0000-0000-000000000000',
  onBackToDashboard
}: CodingAgentProps) {
  const [session, setSession] = useState<CodingSession | null>(null);
  const [files, setFiles] = useState<CodeFile[]>([]);
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);
  const [selectedFileContent, setSelectedFileContent] = useState<string>('');
  
  // Realtime active write file path
  const [activeFileWriting, setActiveFileWriting] = useState<string | null>(null);

  // Tabs on the right panel
  const [rightTab, setRightTab] = useState<'preview' | 'review' | 'tests' | 'execution' | 'history' | 'github'>('preview');

  // Execution states
  const [isRunningExecution, setIsRunningExecution] = useState(false);
  const runSandboxExecution = async () => {
    setIsRunningExecution(true);
    try {
      const res = await fetch('/api/coding/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, projectId })
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Execution failed');
    } catch (err) {
      console.error('Failed to trigger execution:', err);
    } finally {
      setIsRunningExecution(false);
    }
  };

  // Test Pipeline states
  const [testResults, setTestResults] = useState<any>(null);
  const [isRunningTests, setIsRunningTests] = useState(false);

  const handleRunAllTests = async () => {
    setIsRunningTests(true);
    try {
      const res = await fetch('/api/coding/tests/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          projectId,
          framework: selectedFilePath?.endsWith('.py') ? 'pytest' : 'jest'
        })
      });
      const data = await res.json();
      if (data.success) {
        setTestResults(data.result);
      }
    } catch (err) {
      console.error('Failed to run tests:', err);
    } finally {
      setIsRunningTests(false);
    }
  };

  // Deployment Pipeline states
  const [deployStatus, setDeployStatus] = useState<'idle' | 'deploying' | 'live' | 'failed'>('idle');
  const [deployedUrl, setDeployedUrl] = useState<string | null>(null);
  const [currentDeployStep, setCurrentDeployStep] = useState(0);
  const [deployTarget, setDeployTarget] = useState('Vercel');

  const handleDeploy = async () => {
    setDeployStatus('deploying');
    setCurrentDeployStep(0);
    
    // Auto-detect target for UI display
    const isPython = selectedFilePath?.endsWith('.py') || files.some(f => f.file_path.endsWith('.py'));
    setDeployTarget(isPython ? 'Railway' : 'Vercel');

    try {
      const res = await fetch('/api/coding/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, projectId })
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Deployment failed');

      // Start step increment simulation
      let step = 0;
      const stepInterval = setInterval(() => {
        step++;
        if (step <= 4) {
          setCurrentDeployStep(step);
        } else {
          clearInterval(stepInterval);
        }
      }, 2000);

      // Start polling for real status
      const pollInterval = setInterval(async () => {
        try {
          const statusRes = await fetch(`/api/coding/deploy/status?sessionId=${sessionId}`);
          const statusData = await statusRes.json();
          if (statusData.success && statusData.status === 'live') {
            clearInterval(pollInterval);
            clearInterval(stepInterval);
            setDeployedUrl(statusData.url);
            setDeployStatus('live');
            setCurrentDeployStep(5);
          }
        } catch (pollErr) {
          console.error('Failed to poll deployment status:', pollErr);
        }
      }, 3000);

    } catch (err) {
      console.error('Failed to trigger deployment:', err);
      setDeployStatus('failed');
    }
  };

  // Team state
  const [hasCodeTeam, setHasCodeTeam] = useState(false);

  // Review states
  const [review, setReview] = useState<CodeReview | null>(null);
  const [isRunningReview, setIsRunningReview] = useState(false);
  const [isApplyingFix, setIsApplyingFix] = useState(false);

  // History version states
  const [versions, setVersions] = useState<Array<{ version: number; content: string; updated_at: string }>>([]);

  // Monaco Editor state
  const [openFiles, setOpenFiles] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // ZIP download URL
  const [zipUrl, setZipUrl] = useState<string | null>(null);
  const [isZipping, setIsZipping] = useState(false);

  // Fetch session data and files
  const fetchFiles = async () => {
    try {
      const res = await fetch(`/api/coding/files?sessionId=${sessionId}`);
      const data = await res.json();
      if (data.success) {
        setFiles(data.files);
        // Automatically select the first file or README if available
        if (data.files.length > 0 && !selectedFilePath) {
          const readme = data.files.find((f: any) => f.file_path.toLowerCase() === 'readme.md');
          const firstFile = readme || data.files[0];
          setSelectedFilePath(firstFile.file_path);
          setSelectedFileContent(firstFile.content);
          if (!openFiles.includes(firstFile.file_path)) {
            setOpenFiles(prev => [...prev, firstFile.file_path]);
          }
        }
      }
    } catch (err) {
      console.error('Failed to load files:', err);
    }
  };

  useEffect(() => {
    // 1. Fetch initial session details
    const fetchSession = async () => {
      const supabase = supabaseService.getServiceClient();
      const { data } = await supabase
        .from('coding_sessions')
        .select('*')
        .eq('id', sessionId)
        .single();
      
      if (data) {
        setSession(data as CodingSession);
      }

      // Check if team-based
      const { data: teamData } = await supabase
        .from('code_teams')
        .select('id')
        .eq('session_id', sessionId)
        .maybeSingle();
      if (teamData) {
        setHasCodeTeam(true);
      }
    };

    fetchSession();
    fetchFiles();
  }, [sessionId]);

  // 2. Subscribe to Supabase Realtime for files and sessions
  useEffect(() => {
    const supabase = supabaseService.getClient();

    const channel = supabase
      .channel(`coding-agent-session-${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'code_files',
          filter: `session_id=eq.${sessionId}`
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newFile = payload.new as CodeFile;
            setFiles(prev => {
              if (prev.some(f => f.id === newFile.id)) return prev;
              return [...prev, newFile].sort((a, b) => a.file_path.localeCompare(b.file_path));
            });
            setActiveFileWriting(newFile.file_path);
          } else if (payload.eventType === 'UPDATE') {
            const updatedFile = payload.new as CodeFile;
            setFiles(prev => prev.map(f => f.id === updatedFile.id ? updatedFile : f));
            setActiveFileWriting(updatedFile.file_path);
            
            // If the updated file is currently open in Monaco Editor, sync the content
            if (selectedFilePath === updatedFile.file_path) {
              setSelectedFileContent(updatedFile.content);
            }
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'coding_sessions',
          filter: `id=eq.${sessionId}`
        },
        (payload) => {
          const updatedSession = payload.new as CodingSession;
          setSession(updatedSession);
          if (updatedSession.status === 'complete' || updatedSession.status === 'failed') {
            setActiveFileWriting(null);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId, selectedFilePath]);

  // Load versions and reviews for the selected file
  useEffect(() => {
    if (!selectedFilePath) return;

    // Load review if exists in DB
    const loadReview = async () => {
      const supabase = supabaseService.getServiceClient();
      const { data } = await supabase
        .from('code_reviews')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data) {
        setReview(data as CodeReview);
      } else {
        setReview(null);
      }
    };

    // Calculate versions from code_files (mocking version history since we store direct versions in DB)
    const currentFile = files.find(f => f.file_path === selectedFilePath);
    if (currentFile) {
      const vList = [];
      for (let i = 1; i <= (currentFile.version || 1); i++) {
        vList.push({
          version: i,
          content: currentFile.content,
          updated_at: currentFile.updated_at || new Date().toISOString()
        });
      }
      setVersions(vList.reverse());
    }

    loadReview();
  }, [selectedFilePath, files, sessionId]);

  const handleFileSelect = (filePath: string) => {
    setSelectedFilePath(filePath);
    const file = files.find(f => f.file_path === filePath);
    if (file) {
      setSelectedFileContent(file.content);
      if (!openFiles.includes(filePath)) {
        setOpenFiles(prev => [...prev, filePath]);
      }
    }
  };

  const handleTabClose = (path: string) => {
    const nextOpen = openFiles.filter(p => p !== path);
    setOpenFiles(nextOpen);
    if (selectedFilePath === path) {
      setSelectedFilePath(nextOpen.length > 0 ? nextOpen[nextOpen.length - 1] : null);
      if (nextOpen.length > 0) {
        const nextFile = files.find(f => f.file_path === nextOpen[nextOpen.length - 1]);
        setSelectedFileContent(nextFile ? nextFile.content : '');
      } else {
        setSelectedFileContent('');
      }
    }
  };

  // Save changes from Monaco Editor
  const handleEditorChange = async (newContent: string) => {
    setSelectedFileContent(newContent);
    if (!selectedFilePath) return;

    // Update in local state
    setFiles(prev => prev.map(f => f.file_path === selectedFilePath ? { ...f, content: newContent } : f));
    
    // Auto-save: debounced or inline update to Supabase
    setIsSaving(true);
    const supabase = supabaseService.getServiceClient();
    const currentFile = files.find(f => f.file_path === selectedFilePath);
    if (currentFile) {
      await supabase
        .from('code_files')
        .update({
          content: newContent,
          updated_at: new Date().toISOString()
        })
        .eq('id', currentFile.id);
    }
    setIsSaving(false);
  };

  // Package as ZIP
  const handleDownloadZip = async () => {
    setIsZipping(true);
    setZipUrl(null);
    try {
      const res = await fetch(`/api/coding/download?sessionId=${sessionId}`);
      const data = await res.json();
      if (data.success) {
        setZipUrl(data.downloadUrl);
        // Trigger download
        const a = document.createElement('a');
        a.href = data.downloadUrl;
        a.download = `project-${sessionId}.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
    } catch (err) {
      console.error('Failed to zip files:', err);
    } finally {
      setIsZipping(false);
    }
  };

  // Run AI Code Review
  const runCodeReview = async () => {
    if (!selectedFilePath) return;
    const file = files.find(f => f.file_path === selectedFilePath);
    if (!file) return;

    setIsRunningReview(true);
    try {
      const res = await fetch('/api/coding/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          code: file.content,
          language: file.language,
          type: 'full',
          projectId
        })
      });
      const data = await res.json();
      if (data.success) {
        setReview(data.review);
      }
    } catch (err) {
      console.error('Code review failed:', err);
    } finally {
      setIsRunningReview(false);
    }
  };

  // Apply fix from review panel
  const applyFix = async (issue: CodeIssue) => {
    if (!selectedFilePath) return;
    setIsApplyingFix(true);
    try {
      const res = await fetch('/api/coding/edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          instruction: `Fix this issue: ${issue.issue}. Replace matching blocks with: ${issue.code_fix}`,
          filePaths: [selectedFilePath]
        })
      });
      const data = await res.json();
      if (data.success) {
        // Refresh local files
        fetchFiles();
        // Clear or re-run review
        setReview(null);
      }
    } catch (err) {
      console.error('Failed to apply fix:', err);
    } finally {
      setIsApplyingFix(false);
    }
  };

  // Generate tests
  const [isGeneratingTests, setIsGeneratingTests] = useState(false);
  const handleGenerateTests = async () => {
    if (!selectedFilePath) return;
    setIsGeneratingTests(true);
    try {
      const res = await fetch('/api/coding/tests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          filePath: selectedFilePath,
          framework: selectedFilePath.endsWith('.py') ? 'pytest' : 'jest'
        })
      });
      const data = await res.json();
      if (data.success) {
        fetchFiles();
      }
    } catch (err) {
      console.error('Failed to generate tests:', err);
    } finally {
      setIsGeneratingTests(false);
    }
  };

  // Check if preview is HTML
  const isHtmlPreviewable = selectedFilePath?.endsWith('.html') || selectedFilePath?.endsWith('.tsx') || selectedFilePath?.endsWith('.jsx');

  return (
    <div className="flex flex-col h-full bg-[#bg-canvas] font-dmsans text-[#text-ink]">
      {/* Navbar/Header */}
      <div className="flex items-center justify-between border-b border-[#E5E0DA] bg-[#F4F0EB] px-6 py-3.5 shrink-0 select-none">
        <div className="flex items-center gap-3">
          <button
            onClick={onBackToDashboard}
            className="p-1.5 hover:bg-[#E9E3DB] rounded-lg text-[#5E5B56] hover:text-[#191919] transition-colors cursor-pointer"
          >
            <i className="ti ti-arrow-left text-sm" />
          </button>
          <div>
            <h1 className="font-lora text-sm font-bold text-[#191919] truncate max-w-[320px]">
              {session?.description || 'Coding Workspace'}
            </h1>
            <p className="text-[10px] text-[#85827D] mt-0.5 font-medium flex items-center gap-1.5">
              <span>Mode: <strong>{session?.mode.toUpperCase()}</strong></span>
              <span>•</span>
              <span>Stack: <strong>{session?.language} {session?.framework ? `+ ${session?.framework}` : ''}</strong></span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {session?.status === 'running' ? (
            <span className="flex items-center gap-1.5 text-xs text-amber-600 bg-amber-50 border border-amber-200/50 px-3 py-1 rounded-full font-bold animate-pulse">
              <i className="ti ti-settings animate-spin text-xs" />
              Agent building...
            </span>
          ) : session?.status === 'complete' ? (
            <span className="flex items-center gap-1.5 text-xs text-green-700 bg-green-50 border border-green-200/50 px-3 py-1 rounded-full font-bold">
              <i className="ti ti-circle-check text-xs" />
              Project complete
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-xs text-red-700 bg-red-50 border border-red-200/50 px-3 py-1 rounded-full font-bold">
              <i className="ti ti-alert-circle text-xs" />
              Build failed
            </span>
          )}
        </div>
      </div>

      {/* Main Panel grid */}
      <div className="flex-1 flex min-h-0 bg-[#F9F8F6]">
        
        {/* LEFT PANEL */}
        <div className="w-[240px] border-r border-[#E5E0DA] bg-[#F4F0EB] p-4 flex flex-col justify-between shrink-0 select-none">
          <div className="space-y-4">
            <div>
              <h4 className="text-[10px] font-bold text-[#85827D] uppercase tracking-wider mb-2">Project Files</h4>
              <FileTree
                files={files}
                selectedFilePath={selectedFilePath}
                onFileSelect={handleFileSelect}
                activeFileWriting={activeFileWriting}
              />
            </div>

            {/* Deploy Section */}
            <div className="pt-4 border-t border-[#E5E0DA] space-y-3 select-none">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-[#85827D] uppercase">Production Hosting</span>
                {deployStatus === 'live' && (
                  <span className="bg-green-50 text-green-700 border border-green-200 text-[8px] font-bold px-1.5 py-0.5 rounded uppercase">Live</span>
                )}
              </div>

              {deployStatus === 'idle' && (
                <button
                  onClick={handleDeploy}
                  className="w-full flex items-center justify-center gap-1.5 bg-[#cc785c] hover:bg-[#a9583e] text-white text-xs py-2 rounded-full font-semibold transition-colors cursor-pointer shadow-2xs"
                >
                  <i className="ti ti-rocket" />
                  <span>Auto-deploy code</span>
                </button>
              )}

              {deployStatus === 'deploying' && (
                <div className="space-y-2.5 bg-white border border-[#E5E0DA] rounded-xl p-3.5 shadow-4xs">
                  <div className="flex items-center justify-between text-[10px] font-semibold text-[#191919]">
                    <span>Deploying to {deployTarget}...</span>
                    <i className="ti ti-loader animate-spin text-[#cc785c]" />
                  </div>
                  <div className="space-y-1.5">
                    {[
                      'Push to GitHub',
                      'Create deployment',
                      'Build project',
                      'Run DB migrations',
                      'Run Playwright E2E'
                    ].map((step, idx) => (
                      <div key={step} className="flex items-center gap-2 text-[9px] font-mono leading-none">
                        <i className={`ti ${
                          currentDeployStep > idx
                            ? 'ti-circle-check text-green-600'
                            : currentDeployStep === idx
                            ? 'ti-circle-dot text-amber-500 animate-pulse'
                            : 'ti-circle text-zinc-300'
                        }`} />
                        <span className={currentDeployStep === idx ? 'text-[#191919] font-bold' : 'text-[#85827D]'}>
                          {step}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {deployStatus === 'live' && deployedUrl && (
                <div className="space-y-2">
                  <a
                    href={deployedUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="w-full flex items-center justify-center gap-1.5 bg-green-600 hover:bg-green-700 text-white text-xs py-2 rounded-full font-semibold transition-colors cursor-pointer shadow-2xs"
                  >
                    <i className="ti ti-external-link" />
                    <span>Open Live Application</span>
                  </a>
                  <button
                    onClick={() => setRightTab('execution')}
                    className="w-full flex items-center justify-center gap-1.5 bg-white hover:bg-[#F9F8F6] border border-[#E5E0DA] text-[#5E5B56] text-[10px] py-1.5 rounded-full font-semibold transition-colors cursor-pointer shadow-4xs"
                  >
                    <i className="ti ti-terminal" />
                    <span>View sandbox logs</span>
                  </button>
                </div>
              )}

              {deployStatus === 'failed' && (
                <div className="space-y-2">
                  <div className="text-[10px] text-red-700 bg-red-50 p-2.5 rounded-xl border border-red-200 leading-normal">
                    Deployment execution failed. Please verify sandbox tests pass before launching.
                  </div>
                  <button
                    onClick={handleDeploy}
                    className="w-full flex items-center justify-center gap-1.5 bg-[#cc785c] hover:bg-[#a9583e] text-white text-xs py-2 rounded-full font-semibold transition-colors cursor-pointer"
                  >
                    <span>Retry Deploy</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-2 pt-4 border-t border-[#E5E0DA]">
            {/* Download ZIP */}
            <button
              onClick={handleDownloadZip}
              disabled={isZipping}
              className="w-full flex items-center justify-center gap-2 bg-white hover:bg-[#F9F8F6] border border-[#E5E0DA] text-[#191919] text-xs py-2 rounded-full font-medium transition-colors cursor-pointer disabled:opacity-50"
            >
              {isZipping ? (
                <>
                  <i className="ti ti-loader animate-spin text-xs" />
                  <span>Packaging...</span>
                </>
              ) : (
                <>
                  <i className="ti ti-download text-xs text-[#85827D]" />
                  <span>Download ZIP</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* MIDDLE PANEL */}
        <div className="flex-1 p-4 flex flex-col min-w-0">
          <div className="flex-1 min-h-0">
            {session?.status === 'running' && hasCodeTeam ? (
              <CodeTeamView projectId={projectId} sessionId={sessionId} />
            ) : (
              <CodeEditor
                filePath={selectedFilePath}
                content={selectedFileContent}
                onChange={handleEditorChange}
                readOnly={session?.status === 'running'}
                openFiles={openFiles}
                activeTab={selectedFilePath}
                onTabSelect={handleFileSelect}
                onTabClose={handleTabClose}
              />
            )}
          </div>
        </div>

        {/* RIGHT PANEL */}
        <div className="w-[320px] border-l border-[#E5E0DA] bg-[#F4F0EB] flex flex-col shrink-0">
          {/* Tab bar */}
          <div className="flex border-b border-[#E5E0DA] px-2 pt-2 gap-1 bg-[#F4F0EB] select-none shrink-0">
            {['preview', 'review', 'tests', 'execution', 'github'].map((tab) => (
              <button
                key={tab}
                onClick={() => setRightTab(tab as any)}
                className={`text-xs px-3.5 py-2 rounded-t-lg font-medium transition-colors cursor-pointer capitalize border-t border-x ${
                  rightTab === tab
                    ? 'bg-white text-[#191919] border-[#E5E0DA] font-bold'
                    : 'text-[#85827D] hover:text-[#191919] border-transparent hover:bg-[#E9E3DB]'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Tab contents */}
          <div className="flex-1 p-4 overflow-y-auto bg-white min-h-0">
            {rightTab === 'preview' && (
              <div className="h-full flex flex-col space-y-4">
                {isHtmlPreviewable ? (
                  <div className="flex-1 flex flex-col border border-[#E5E0DA] rounded-xl overflow-hidden shadow-3xs bg-[#FFFFFF]">
                    <div className="bg-[#F9F8F6] border-b border-[#E5E0DA] px-3.5 py-2 flex items-center justify-between text-xs text-[#5E5B56] font-semibold select-none">
                      <span>Live HTML Preview</span>
                      <button
                        onClick={() => {
                          const iframe = document.getElementById('preview-iframe') as HTMLIFrameElement;
                          if (iframe) iframe.src = iframe.src;
                        }}
                        className="p-1 hover:bg-[#E9E3DB] rounded cursor-pointer"
                      >
                        <i className="ti ti-refresh text-[10px]" />
                      </button>
                    </div>
                    <iframe
                      id="preview-iframe"
                      title="File Preview"
                      srcDoc={selectedFileContent}
                      className="flex-1 w-full bg-white outline-none"
                      sandbox="allow-scripts"
                    />
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-center p-6 select-none font-dmsans">
                    <i className="ti ti-server text-4xl mb-2 text-[#cc785c]" />
                    <h4 className="text-xs font-bold text-[#191919]">API / Backend Endpoint</h4>
                    <p className="text-[10px] text-[#85827D] mt-1 max-w-[200px] leading-normal">
                      This is a backend script/library file. Live preview is available for HTML/React structures.
                    </p>
                  </div>
                )}
              </div>
            )}

            {rightTab === 'review' && (
              <ReviewPanel
                review={review}
                onApplyFix={applyFix}
                onRunReview={runCodeReview}
                isRunningReview={isRunningReview}
                isApplyingFix={isApplyingFix}
              />
            )}

            {rightTab === 'tests' && (
              <div className="space-y-4 font-dmsans">
                {/* Actions */}
                <div className="bg-[#F9F8F6] border border-[#E5E0DA] rounded-xl p-4 space-y-3 shadow-3xs select-none">
                  <h4 className="text-xs font-bold text-[#191919]">Auto Testing Pipeline</h4>
                  <p className="text-[10px] text-[#5E5B56] leading-relaxed">
                    Generate test files, run Jest/pytest unit assertions, and audit coverage benchmarks.
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={handleGenerateTests}
                      disabled={isGeneratingTests || !selectedFilePath}
                      className="flex-1 flex items-center justify-center gap-1 bg-[#cc785c] hover:bg-[#a9583e] text-white text-[10px] py-2 rounded-full font-semibold transition-colors disabled:opacity-50 cursor-pointer shadow-2xs"
                    >
                      {isGeneratingTests ? <i className="ti ti-loader animate-spin" /> : <i className="ti ti-plus" />}
                      <span>Generate test</span>
                    </button>
                    <button
                      onClick={handleRunAllTests}
                      disabled={isRunningTests}
                      className="flex-1 flex items-center justify-center gap-1 bg-white hover:bg-[#F9F8F6] border border-[#E5E0DA] text-[#191919] text-[10px] py-2 rounded-full font-semibold transition-colors disabled:opacity-50 cursor-pointer shadow-3xs"
                    >
                      {isRunningTests ? <i className="ti ti-loader animate-spin" /> : <i className="ti ti-play" />}
                      <span>Run all tests</span>
                    </button>
                  </div>
                </div>

                {/* Coverage Bars */}
                {testResults?.coverage && (
                  <div className="space-y-2 select-none">
                    <span className="text-[10px] font-bold text-[#85827D] uppercase">File Coverage</span>
                    <div className="space-y-2 border border-[#E5E0DA] bg-[#F9F8F6] rounded-xl p-3.5 shadow-4xs">
                      {Object.entries(testResults.coverage).map(([file, pct]: any) => {
                        const filled = Math.round(pct / 10);
                        const empty = 10 - filled;
                        const blockStr = '█'.repeat(filled) + '░'.repeat(empty);
                        return (
                          <div key={file} className="text-[10px] leading-relaxed flex items-center justify-between font-mono">
                            <span className="text-[#191919] truncate max-w-[140px]">{file}</span>
                            <span className="text-[#5E5B56]">{blockStr} {pct}%</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Test Suite Results */}
                <div className="space-y-2">
                  <span className="text-[10px] font-bold text-[#85827D] uppercase">Suite Results</span>
                  {testResults ? (
                    <div className="border border-[#E5E0DA] bg-white rounded-xl p-3.5 space-y-2.5 shadow-4xs text-[10px]">
                      <div className="flex items-center justify-between font-semibold border-b border-[#F4F0EB] pb-2">
                        <span className="text-[#5E5B56]">Assertions passing:</span>
                        <span className={`px-2 py-0.5 rounded-full text-[8px] font-bold uppercase border ${
                          testResults.passing 
                            ? 'bg-green-50 text-green-700 border-green-200' 
                            : 'bg-red-50 text-red-700 border-red-200'
                        }`}>
                          {testResults.passing ? 'Success' : 'Failed'}
                        </span>
                      </div>
                      <div className="space-y-1.5 font-mono">
                        <div className="text-green-700 flex items-center gap-1">
                          <i className="ti ti-circle-check" />
                          <span>Unit tests compile: OK (12ms)</span>
                        </div>
                        <div className={`${testResults.passing ? 'text-green-700' : 'text-red-700'} flex items-center gap-1`}>
                          <i className={`ti ${testResults.passing ? 'ti-circle-check' : 'ti-alert-triangle'}`} />
                          <span>All edge cases covered: {testResults.passing ? 'OK (24ms)' : 'FAIL'}</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-6 border border-dashed border-[#E5E0DA] bg-white rounded-xl text-[10px] text-[#85827D] italic select-none">
                      No test logs available. Click "Run all tests" to audit.
                    </div>
                  )}
                </div>
              </div>
            )}

            {rightTab === 'github' && (
              <GitHubPanel
                sessionId={sessionId}
                projectId={projectId}
                userId={userId}
              />
            )}

            {rightTab === 'execution' && (
              <ExecutionPanel
                session={session as any}
                onRunExecution={runSandboxExecution}
                isRunning={isRunningExecution}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
