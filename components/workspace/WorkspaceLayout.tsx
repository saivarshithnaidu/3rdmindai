'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Sidebar from '../sidebar/Sidebar';
import RightPanel from '../rightpanel/RightPanel';
import OrchestratorChat from './OrchestratorChat';
import AgentChat from './AgentChat';
import AgentBreadcrumb from './AgentBreadcrumb';
import { Project, Agent, Message } from '../../types';
import { supabaseService } from '../../services/supabase.service';
import { Share2, Settings, PanelRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { DEFAULT_ORCHESTRATOR_MODEL } from '../../lib/constants';
import ConnectorsPage from '../connectors/ConnectorsPage';
import ScraperPicker from '../browser/ScraperPicker';

interface WorkspaceLayoutProps {
  initialProject: Project;
  initialAgents: Agent[];
  allProjects: Project[];
}

export default function WorkspaceLayout({
  initialProject,
  initialAgents,
  allProjects,
}: WorkspaceLayoutProps) {
  const router = useRouter();
  const [project, setProject] = useState<Project>(initialProject);
  const [agents, setAgents] = useState<Agent[]>(initialAgents);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isRightPanelOpen, setIsRightPanelOpen] = useState(true);
  const [rightPanelWidth, setRightPanelWidth] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('3rdmind-panel-width');
      if (saved) {
        const val = parseInt(saved, 10);
        return val > 100 ? 35 : val; // Reset old fixed-pixel layouts to 35%
      }
      return 35;
    }
    return 35;
  });

  const handlePanelWidthChange = useCallback((width: number) => {
    setRightPanelWidth(width);
    localStorage.setItem('3rdmind-panel-width', String(width));
  }, []);
  const [selectedModel, setSelectedModel] = useState(DEFAULT_ORCHESTRATOR_MODEL);
  const [isOrchestratorLoading, setIsOrchestratorLoading] = useState(false);
  const [activeNavItem, setActiveNavItem] = useState('Chats');
  const [activeRightTab, setActiveRightTab] = useState<'agents' | 'memory' | 'files' | 'preview' | 'canvas' | 'artifact' | 'council' | 'browser' | 'tools'>('agents');
  const [activeConnectorsCount, setActiveConnectorsCount] = useState<number>(0);

  const fetchActiveConnectorsCount = useCallback(async () => {
    try {
      const response = await fetch('/api/connectors/list?userId=00000000-0000-0000-0000-000000000000');
      if (response.ok) {
        const data = await response.json();
        const list = data && Array.isArray(data.connectors) ? data.connectors : Array.isArray(data) ? data : [];
        const activeCount = list.filter((c: any) => c.isConnected || c.isActive).length;
        setActiveConnectorsCount(activeCount);
      }
    } catch (e) {
      console.error('Failed to fetch active connectors count:', e);
    }
  }, []);

  useEffect(() => {
    fetchActiveConnectorsCount();
  }, [activeNavItem, fetchActiveConnectorsCount]);

  const [browserSessions, setBrowserSessions] = useState<any[]>([]);
  const [activeSession, setActiveSession] = useState<any | null>(null);
  const [isBrowserPickerOpen, setIsBrowserPickerOpen] = useState(false);

  // Fetch and subscribe to browser sessions for the project
  useEffect(() => {
    if (!project?.id) return;

    const fetchBrowserSessions = async () => {
      try {
        const response = await fetch(`/api/browser/sessions?projectId=${project.id}`);
        if (response.ok) {
          const data = await response.json();
          setBrowserSessions(data || []);
        }
      } catch (err) {
        console.error('Failed to fetch browser sessions:', err);
      }
    };

    fetchBrowserSessions();

    const supabase = supabaseService.getClient();
    const browserSessionsChannel = supabase
      .channel(`project-browser-sessions-${project.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'browser_sessions',
          filter: `project_id=eq.${project.id}`,
        },
        () => {
          fetchBrowserSessions();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(browserSessionsChannel);
    };
  }, [project.id]);

  // Compute active session and auto-open browser tab on new active sessions
  useEffect(() => {
    const active = browserSessions.find((s) => s.status === 'active');
    if (active) {
      setActiveSession(active);
      setActiveRightTab('browser');
      setIsRightPanelOpen(true);
      if (active.canvas_id) {
        setActiveCanvasId(active.canvas_id);
      }
    } else if (browserSessions.length > 0) {
      setActiveSession(browserSessions[0]);
    } else {
      setActiveSession(null);
    }
  }, [browserSessions]);
  const [hasSwitchedToCouncil, setHasSwitchedToCouncil] = useState(false);
  const [previewContent, setPreviewContent] = useState<string>('');
  const [previewTitle, setPreviewTitle] = useState<string>('Live Preview');

  // Auto-switch to Council tab when a council is running
  useEffect(() => {
    const isCouncilActive = agents.some(a => 
      a.name.toLowerCase().includes('council') || 
      a.task?.toLowerCase().includes('council') ||
      a.task?.toLowerCase().includes('debate')
    );
    if (isCouncilActive && !hasSwitchedToCouncil) {
      setActiveRightTab('council');
      setIsRightPanelOpen(true);
      setHasSwitchedToCouncil(true);
    } else if (!isCouncilActive && hasSwitchedToCouncil) {
      setHasSwitchedToCouncil(false);
    }
  }, [agents, hasSwitchedToCouncil]);

  // Live Data Canvas & Artifact states
  const [activeCanvasId, setActiveCanvasId] = useState<string | null>(null);
  const [activeArtifactId, setActiveArtifactId] = useState<string | null>(null);
  const [artifactCode, setArtifactCode] = useState<string>('');
  const [artifactTitle, setArtifactTitle] = useState<string>('');
  const [artifactType, setArtifactType] = useState<string>('');
  const [artifactVersion, setArtifactVersion] = useState<number>(1);
  const [chatInputValue, setChatInputValue] = useState<string>('');

  const [councilMode, setCouncilMode] = useState(false);
  const [toolsState, setToolsState] = useState({
    webSearch: true,
    exaSearch: false,
    kaggle: false,
    database: false,
    rag: false
  });
  const [councilConfig, setCouncilConfig] = useState({
    seats: [
      { name: 'Creative', role: 'Creative Seat', model: 'google/gemini-pro-1.5' },
      { name: 'Critic', role: 'Critic Seat', model: 'openai/gpt-4o' },
      { name: 'Auditor', role: 'Auditor Seat', model: 'deepseek/deepseek-chat' },
      { name: 'General', role: 'General Seat', model: 'meta-llama/llama-3-70b-instruct' }
    ],
    enableVerdict: true
  });

  const handleToggleToolsPanel = useCallback(() => {
    if (activeRightTab === 'tools' && isRightPanelOpen) {
      setIsRightPanelOpen(false);
    } else {
      setActiveRightTab('tools');
      setIsRightPanelOpen(true);
    }
  }, [activeRightTab, isRightPanelOpen]);

  // Auto-expand to 50% split when a Canvas or Artifact becomes active
  useEffect(() => {
    if (activeCanvasId || activeArtifactId) {
      setRightPanelWidth(50);
      setIsRightPanelOpen(true);
      if (activeCanvasId) {
        setActiveRightTab('canvas');
      } else {
        setActiveRightTab('artifact');
      }
    }
  }, [activeCanvasId, activeArtifactId]);

  const handleOpenPreview = useCallback((code: string, title: string) => {
    setPreviewContent(code);
    setPreviewTitle(title);
    setIsRightPanelOpen(true);
    setActiveRightTab('preview');
  }, []);

  const handleNavClick = (label: string) => {
    setActiveNavItem(label);
    if (label === 'Chats') {
      setSelectedAgentId(null);
    } else if (label === 'Agents') {
      setIsRightPanelOpen(true);
      setActiveRightTab('agents');
    } else if (label === 'Artifacts') {
      setIsRightPanelOpen(true);
      setActiveRightTab('files');
    } else if (label === 'Memory') {
      setIsRightPanelOpen(true);
      setActiveRightTab('memory');
    } else if (label === 'Connectors') {
      // Connectors view state
    } else if (label === 'Customize') {
      alert("Customization option coming soon! Here you can customize system prompts and default agent behavior.");
      setActiveNavItem('Chats');
    }
  };

  const activeAgent = selectedAgentId
    ? agents.find((a) => a.id === selectedAgentId)
    : agents.find((a) => a.type === 'orchestrator');

  // Fetch agents list
  const fetchAgents = useCallback(async () => {
    try {
      const response = await fetch(`/api/project/${project.id}/agents`);
      if (response.ok) {
        const data = await response.json();
        setAgents(data);
      }
    } catch (e) {
      console.error('Failed to fetch agents:', e);
    }
  }, [project.id]);

  // Fetch messages for active agent
  const fetchMessages = useCallback(async () => {
    if (!activeAgent) return;
    try {
      const response = await fetch(`/api/agent/${activeAgent.id}/messages`);
      if (response.ok) {
        const data = await response.json();
        setMessages(data);
      }
    } catch (e) {
      console.error('Failed to fetch messages:', e);
    }
  }, [activeAgent]);

  // Fetch messages when selected agent or active agent changes
  useEffect(() => {
    fetchMessages();
  }, [selectedAgentId, activeAgent, fetchMessages]);

  // Initialize data and setup Supabase realtime subscriptions
  useEffect(() => {
    const supabase = supabaseService.getClient();

    // Subscribe to messages changes for the project
    const messagesChannel = supabase
      .channel(`project-messages-${project.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
          filter: `project_id=eq.${project.id}`,
        },
        () => {
          fetchMessages();
        }
      )
      .subscribe();

    // Subscribe to agents changes for the project
    const agentsChannel = supabase
      .channel(`project-agents-${project.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'agents',
          filter: `project_id=eq.${project.id}`,
        },
        () => {
          fetchAgents();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(messagesChannel);
      supabase.removeChannel(agentsChannel);
    };
  }, [project.id, fetchMessages, fetchAgents]);

  const triggerOrchestratorChat = async (model: string, options?: any) => {
    if (!activeAgent) return;
    try {
      // Set orchestrator agent status to running
      await fetch(`/api/agent/${activeAgent.id}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'running' }),
      });

      // Trigger chat completion stream
      const chatRes = await fetch('/api/orchestrator/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: project.id,
          agentId: activeAgent.id,
          model,
          options,
        }),
      });

      if (!chatRes.ok) throw new Error('Chat generation failed');

      // Consume stream to wait for completion
      if (chatRes.body) {
        const reader = chatRes.body.getReader();
        while (true) {
          const { done } = await reader.read();
          if (done) break;
        }
      }

      // Update status back to done
      await fetch(`/api/agent/${activeAgent.id}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'done' }),
      });
    } catch (e) {
      console.error('Error in orchestrator chat stream:', e);
      // Mark as error status
      await fetch(`/api/agent/${activeAgent.id}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'error' }),
      });
      throw e;
    }
  };

  const handleSendMessage = async (content: string, model: string, options?: any) => {
    if (!activeAgent || activeAgent.type !== 'orchestrator') return;

    setIsOrchestratorLoading(true);
    setChatInputValue('');

    // Check 1: Live Data Canvas Request Check
    try {
      const canvasDetectRes = await fetch('/api/canvas/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: project.id,
          agentId: activeAgent.id,
          message: content,
        }),
      });

      if (canvasDetectRes.ok) {
        const canvasData = await canvasDetectRes.json();
        if (canvasData.isDataRequest && canvasData.canvas) {
          // 1. Save user message to database
          await fetch(`/api/agent/${activeAgent.id}/messages`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              projectId: project.id,
              role: 'user',
              content,
            }),
          });

          // 2. Set active canvas and tab
          setActiveCanvasId(canvasData.canvas.id);
          setIsRightPanelOpen(true);
          setActiveRightTab('canvas');

          // 3. Save initial assistant message indicating compilation
          await fetch(`/api/agent/${activeAgent.id}/messages`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              projectId: project.id,
              role: 'assistant',
              content: `📊 **Live Data Canvas Opened**: Researching and compiling "${canvasData.canvas.name}" directly in your Right Panel.`,
            }),
          });

          // 4. Trigger background streaming execution
          fetch('/api/canvas/run', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              canvasId: canvasData.canvas.id,
              query: content,
              columns: canvasData.canvas.columns,
              mode: canvasData.mode,
              enrichmentItems: canvasData.enrichmentItems,
              rowsTarget: canvasData.canvas.rows_target,
            }),
          }).catch((err) => {
            console.error('Failed to trigger background canvas run:', err);
          });

          setIsOrchestratorLoading(false);
          return; // Skip standard chat pipeline
        }
      }
    } catch (e) {
      console.warn('Canvas detection check failed:', e);
    }

    // Check 2: Browser Agent Request Check
    try {
      const browserDetectRes = await fetch('/api/browser/detect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: content }),
      });

      if (browserDetectRes.ok) {
        const detection = await browserDetectRes.json();
        if (detection.needsBrowser && detection.scraper) {
          // 1. Save user message to database
          await fetch(`/api/agent/${activeAgent.id}/messages`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              projectId: project.id,
              role: 'user',
              content,
            }),
          });

          // 2. Save initial assistant message indicating browser is launching
          await fetch(`/api/agent/${activeAgent.id}/messages`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              projectId: project.id,
              role: 'assistant',
              content: `🌐 **Opening browser to find this data...** Running browser automation with query "${detection.query}"`,
            }),
          });

          // 3. Trigger browser scraping
          const scrapeRes = await fetch('/api/browser/scrape', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              projectId: project.id,
              agentId: activeAgent.id,
              scraperType: detection.scraper,
              query: detection.query,
              maxResults: detection.maxResults
            }),
          });

          if (scrapeRes.ok) {
            const scrapeData = await scrapeRes.json();
            // 4. Set active canvas and tab to browser
            setActiveCanvasId(scrapeData.canvasId);
            setIsRightPanelOpen(true);
            setActiveRightTab('browser');
          }

          setIsOrchestratorLoading(false);
          return; // Skip standard chat pipeline
        }
      }
    } catch (err) {
      console.warn('Browser detection check failed:', err);
    }

    // Check 3: Artifact Request Check (New or Update)
    try {
      if (activeArtifactId && artifactCode) {
        // This is a follow-up/update change request for the active artifact
        // 1. Save user message to database
        await fetch(`/api/agent/${activeAgent.id}/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectId: project.id,
            role: 'user',
            content,
          }),
        });

        setIsRightPanelOpen(true);
        setActiveRightTab('artifact');

        // Save assistant typing/loading status message
        await fetch(`/api/agent/${activeAgent.id}/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectId: project.id,
            role: 'assistant',
            content: `🎨 **Updating Artifact**: Modifying visual component "${artifactTitle}"...`,
          }),
        });

        // Trigger update API
        const updateRes = await fetch('/api/artifact/update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            artifactId: activeArtifactId,
            changeRequest: content,
            currentCode: artifactCode,
            version: artifactVersion,
            model,
          }),
        });

        if (updateRes.ok) {
          const artId = updateRes.headers.get('X-Artifact-Id');
          const nextVersion = parseInt(updateRes.headers.get('X-Artifact-Version') || String(artifactVersion + 1), 10);
          
          if (artId) setActiveArtifactId(artId);
          setArtifactVersion(nextVersion);
          setArtifactCode(''); // Clear to start streaming

          const reader = updateRes.body?.getReader();
          const decoder = new TextDecoder();
          let accumulated = '';

          if (reader) {
            try {
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                const chunk = decoder.decode(value, { stream: true });
                accumulated += chunk;
                
                let cleaned = accumulated.trim();
                if (cleaned.startsWith('```html')) {
                  cleaned = cleaned.slice(7);
                } else if (cleaned.startsWith('```')) {
                  cleaned = cleaned.slice(3);
                }
                if (cleaned.endsWith('```')) {
                  cleaned = cleaned.slice(0, -3);
                }
                setArtifactCode(cleaned.trim());
              }
            } catch (err) {
              console.error('Error reading artifact update stream:', err);
            }
          }

          await fetch(`/api/agent/${activeAgent.id}/messages`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              projectId: project.id,
              role: 'assistant',
              content: `✨ **Artifact Updated**: Version ${nextVersion} of "${artifactTitle}" is ready.`,
            }),
          });
        } else {
          throw new Error('Artifact update API failed');
        }

        setIsOrchestratorLoading(false);
        return; // Skip standard chat pipeline
      }

      // Check if it is a brand new artifact request
      const artifactDetectRes = await fetch('/api/artifact/detect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: content }),
      });

      if (artifactDetectRes.ok) {
        const artifactData = await artifactDetectRes.json();
        if (artifactData.isArtifactRequest) {
          // Yes! Build new artifact!
          // 1. Save user message to database
          await fetch(`/api/agent/${activeAgent.id}/messages`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              projectId: project.id,
              role: 'user',
              content,
            }),
          });

          setIsRightPanelOpen(true);
          setActiveRightTab('artifact');

          // Save assistant loading message
          await fetch(`/api/agent/${activeAgent.id}/messages`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              projectId: project.id,
              role: 'assistant',
              content: `🎨 **Building Artifact**: Generating visual component "${artifactData.title}"...`,
            }),
          });

          // Trigger generate API
          const genRes = await fetch('/api/artifact/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              projectId: project.id,
              agentId: activeAgent.id,
              prompt: content,
              type: artifactData.type,
              title: artifactData.title,
              model,
            }),
          });

          if (genRes.ok) {
            const artId = genRes.headers.get('X-Artifact-Id');
            const title = genRes.headers.get('X-Artifact-Title') || artifactData.title;
            const type = genRes.headers.get('X-Artifact-Type') || artifactData.type;
            const version = parseInt(genRes.headers.get('X-Artifact-Version') || '1', 10);

            if (artId) setActiveArtifactId(artId);
            if (title) setArtifactTitle(title);
            if (type) setArtifactType(type);
            setArtifactVersion(version);
            setArtifactCode(''); // Clear to start streaming

            const reader = genRes.body?.getReader();
            const decoder = new TextDecoder();
            let accumulated = '';

            if (reader) {
              try {
                while (true) {
                  const { done, value } = await reader.read();
                  if (done) break;
                  const chunk = decoder.decode(value, { stream: true });
                  accumulated += chunk;
                  
                  let cleaned = accumulated.trim();
                  if (cleaned.startsWith('```html')) {
                    cleaned = cleaned.slice(7);
                  } else if (cleaned.startsWith('```')) {
                    cleaned = cleaned.slice(3);
                  }
                  if (cleaned.endsWith('```')) {
                    cleaned = cleaned.slice(0, -3);
                  }
                  setArtifactCode(cleaned.trim());
                }
              } catch (err) {
                console.error('Error reading artifact generate stream:', err);
              }
            }

            await fetch(`/api/agent/${activeAgent.id}/messages`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                projectId: project.id,
                role: 'assistant',
                content: `✨ **Artifact Generated**: Component "${title}" is ready and interactive in your Artifact tab.`,
              }),
            });
          } else {
            throw new Error('Artifact generation API failed');
          }

          setIsOrchestratorLoading(false);
          return; // Skip standard chat pipeline
        }
      }
    } catch (e) {
      console.warn('Artifact detection check failed:', e);
    }

    // Default chat completion pipeline fallback
    try {
      // 1. Save user message to database
      const saveRes = await fetch(`/api/agent/${activeAgent.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: project.id,
          role: 'user',
          content,
        }),
      });

      if (!saveRes.ok) throw new Error('Failed to save message');

      // 2. Trigger orchestrator chat stream and wait for done
      await triggerOrchestratorChat(model, options);

    } catch (e) {
      console.error('Error sending message:', e);
    } finally {
      setIsOrchestratorLoading(false);
    }
  };

  const handleEditMessage = async (messageId: string, newContent: string) => {
    if (!activeAgent) return;
    setIsOrchestratorLoading(true);
    try {
      // 1. Update the message content in the database
      const updateRes = await fetch(`/api/message/${messageId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newContent }),
      });
      if (!updateRes.ok) throw new Error('Failed to update message');

      // 2. Truncate subsequent messages (strictly after, inclusive=false)
      const truncateRes = await fetch(`/api/message/${messageId}?truncate=true&inclusive=false`, {
        method: 'DELETE',
      });
      if (!truncateRes.ok) throw new Error('Failed to truncate subsequent messages');

      // Refresh local messages state immediately
      await fetchMessages();

      // 3. Trigger orchestrator chat stream
      await triggerOrchestratorChat(selectedModel);
    } catch (e) {
      console.error('Error editing message:', e);
    } finally {
      setIsOrchestratorLoading(false);
    }
  };

  const handleRegenerateMessage = async (messageId: string) => {
    if (!activeAgent) return;
    setIsOrchestratorLoading(true);
    try {
      // Truncate starting from this assistant message (inclusive=true)
      const truncateRes = await fetch(`/api/message/${messageId}?truncate=true&inclusive=true`, {
        method: 'DELETE',
      });
      if (!truncateRes.ok) throw new Error('Failed to delete assistant message for regeneration');

      // Refresh messages
      await fetchMessages();

      // Trigger orchestrator chat stream
      await triggerOrchestratorChat(selectedModel);
    } catch (e) {
      console.error('Error regenerating message:', e);
    } finally {
      setIsOrchestratorLoading(false);
    }
  };

  const handleSelectPreset = (preset: any) => {
    setChatInputValue(preset.prompt);
    setActiveNavItem('Chats');
  };

  return (
    <div className="flex w-screen h-screen overflow-hidden bg-canvas">
      {/* 1. Left Sidebar */}
      <Sidebar
        projects={allProjects}
        activeProjectId={project.id}
        isCollapsed={isSidebarCollapsed}
        setIsCollapsed={setIsSidebarCollapsed}
        activeNavItem={activeNavItem}
        onNavClick={handleNavClick}
      />

      {/* Main Workspace Frame */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Top Header Bar */}
        <header className="h-12 border-b border-hairline bg-canvas flex items-center justify-between px-4 shrink-0 select-none">
          <div className="flex items-center gap-2 min-w-0">
            <h1 className="font-lora font-normal text-base text-ink tracking-tight shrink-0">
              {project.name}
            </h1>
            
            <span className="text-muted select-none text-xs px-0.5 shrink-0">/</span>

            <AgentBreadcrumb
              agents={agents}
              selectedAgentId={selectedAgentId}
              onSelectAgent={setSelectedAgentId}
              isHeaderMode={true}
            />

            <>
              <span className="text-muted select-none text-xs px-0.5 shrink-0">/</span>
              <button
                type="button"
                onClick={() => {
                  setActiveNavItem('Connectors');
                  router.push('/connectors');
                }}
                className={`flex items-center gap-1.5 text-[10px] font-mono px-2.5 py-0.5 rounded-full border border-hairline/70 shrink-0 cursor-pointer transition-colors ${
                  activeConnectorsCount > 0
                    ? 'bg-[#EBE5DC]/55 text-muted hover:text-ink hover:bg-surface-card'
                    : 'bg-transparent text-muted-soft hover:text-ink font-semibold'
                }`}
              >
                <i className="ti ti-plug-connected text-[10px]" />
                <span>
                  {activeConnectorsCount > 0 
                    ? `${activeConnectorsCount} connector${activeConnectorsCount > 1 ? 's' : ''}` 
                    : 'No connectors'
                  }
                </span>
              </button>
            </>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button type="button" className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-muted hover:text-ink hover:bg-surface-card rounded-lg transition-colors cursor-pointer font-semibold border border-hairline bg-canvas shadow-2xs">
              <Share2 className="w-3.5 h-3.5" />
              <span>Share</span>
            </button>
            <button type="button" className="p-1.5 hover:bg-surface-cream-strong rounded-lg text-muted hover:text-ink transition-colors cursor-pointer">
              <Settings className="w-4.5 h-4.5" />
            </button>
            <button
              type="button"
              onClick={() => setIsRightPanelOpen(!isRightPanelOpen)}
              className={`p-1.5 hover:bg-surface-cream-strong rounded-lg text-muted hover:text-ink transition-colors cursor-pointer border border-hairline shadow-2xs ${
                isRightPanelOpen ? 'bg-surface-cream-strong text-ink' : 'bg-canvas'
              }`}
              title={isRightPanelOpen ? "Hide workspace panel" : "Show workspace panel"}
            >
              <PanelRight className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* 2. Middle Chat Panel */}
        <div className="flex-1 flex overflow-hidden min-h-0">
          {activeNavItem === 'Connectors' ? (
            <ConnectorsPage />
          ) : activeAgent && activeAgent.type === 'subagent' ? (
            <AgentChat
              agent={activeAgent}
              messages={messages}
              onOpenPreview={handleOpenPreview}
            />
          ) : activeAgent ? (
            <OrchestratorChat
              messages={messages}
              isLoading={isOrchestratorLoading || activeAgent.status === 'running'}
              agents={agents}
              selectedModel={selectedModel}
              onModelChange={setSelectedModel}
              onSubmit={handleSendMessage}
              projectId={project.id}
              onOpenPreview={handleOpenPreview}
              onEditMessage={handleEditMessage}
              onRegenerateMessage={handleRegenerateMessage}
              onFileUploaded={(text, filename) => {
                setProject(prev => ({
                  ...prev,
                  master_resume: text,
                  master_resume_filename: filename
                }));
              }}
              inputValue={chatInputValue}
              onInputValueChange={setChatInputValue}
              activeCanvasId={activeCanvasId}
              activeArtifactId={activeArtifactId}
              onOpenBrowserPicker={() => setIsBrowserPickerOpen(true)}
              councilMode={councilMode}
              setCouncilMode={setCouncilMode}
              toolsState={toolsState}
              setToolsState={setToolsState}
              councilConfig={councilConfig}
              setCouncilConfig={setCouncilConfig}
              onToggleToolsPanel={handleToggleToolsPanel}
              isToolsPanelActive={isRightPanelOpen && activeRightTab === 'tools'}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center text-sm text-[#8A8780] italic">
              Loading agent...
            </div>
          )}

          {/* 3. Right Sidebar Panel */}
          <RightPanel
            project={project}
            agents={agents}
            selectedAgentId={selectedAgentId}
            onSelectAgent={setSelectedAgentId}
            isOpen={isRightPanelOpen}
            setIsOpen={setIsRightPanelOpen}
            activeTab={activeRightTab}
            onTabChange={setActiveRightTab}
            onProjectUpdate={setProject}
            previewContent={previewContent}
            previewTitle={previewTitle}
            activeCanvasId={activeCanvasId}
            activeArtifactId={activeArtifactId}
            artifactCode={artifactCode}
            artifactTitle={artifactTitle}
            artifactType={artifactType}
            artifactVersion={artifactVersion}
            onSelectPreset={handleSelectPreset}
            panelWidth={rightPanelWidth}
            onPanelWidthChange={handlePanelWidthChange}
            browserSession={activeSession}
            councilMode={councilMode}
            setCouncilMode={setCouncilMode}
            toolsState={toolsState}
            setToolsState={setToolsState}
            councilConfig={councilConfig}
            setCouncilConfig={setCouncilConfig}
          />
        </div>
      </div>

      <ScraperPicker
        isOpen={isBrowserPickerOpen}
        onClose={() => setIsBrowserPickerOpen(false)}
        projectId={project.id}
        onScrapeStarted={(canvasId) => {
          setActiveCanvasId(canvasId);
          setActiveRightTab('browser');
          setIsRightPanelOpen(true);
        }}
      />
    </div>
  );
}
