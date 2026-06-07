import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Agent, Project, BrowserSession } from '../../types';
import AgentTree from './AgentTree';
import NeuralSymbol from '../workspace/NeuralSymbol';
import LiveDataCanvas from '../canvas/LiveDataCanvas';
import LiveBrowser from '../browser/LiveBrowser';
import ArtifactRenderer from '../artifacts/ArtifactRenderer';
import ArtifactToolbar from '../artifacts/ArtifactToolbar';
import ArtifactPicker from '../artifacts/ArtifactPicker';
import CouncilDebateView from '../council/CouncilDebateView';
import { 
  Database, 
  FileText, 
  ChevronRight, 
  Pin,
  Paperclip,
  Upload,
  Trash2,
  Loader2,
  Plus,
  Check,
  AlertCircle,
  Copy,
  Grid,
  Boxes,
  GitBranch,
  Eye,
  Brain,
  Table2,
  Scale,
  Globe,
  Sliders
} from 'lucide-react';
import { AVAILABLE_MODELS } from '../../lib/constants';

interface RightPanelProps {
  project: Project;
  agents: Agent[];
  selectedAgentId: string | null;
  onSelectAgent: (agentId: string | null) => void;
  isOpen: boolean;
  setIsOpen: (val: boolean) => void;
  activeTab: 'agents' | 'memory' | 'files' | 'preview' | 'canvas' | 'artifact' | 'council' | 'browser' | 'tools';
  onTabChange: (tab: 'agents' | 'memory' | 'files' | 'preview' | 'canvas' | 'artifact' | 'council' | 'browser' | 'tools') => void;
  onProjectUpdate?: (project: Project) => void;
  previewContent?: string;
  previewTitle?: string;
  activeCanvasId?: string | null;
  activeArtifactId?: string | null;
  artifactCode?: string;
  artifactTitle?: string;
  artifactType?: string;
  artifactVersion?: number;
  onSelectPreset?: (preset: any) => void;
  panelWidth?: number;
  onPanelWidthChange?: (width: number) => void;
  browserSession?: BrowserSession | null;
  
  // Optional props for tools & connectors panel integration
  councilMode?: boolean;
  setCouncilMode?: (val: boolean) => void;
  toolsState?: {
    webSearch: boolean;
    exaSearch: boolean;
    kaggle: boolean;
    database: boolean;
    rag: boolean;
  };
  setToolsState?: React.Dispatch<React.SetStateAction<{
    webSearch: boolean;
    exaSearch: boolean;
    kaggle: boolean;
    database: boolean;
    rag: boolean;
  }>>;
  councilConfig?: {
    seats: Array<{ name: string; role: string; model: string }>;
    enableVerdict: boolean;
  };
  setCouncilConfig?: React.Dispatch<React.SetStateAction<{
    seats: Array<{ name: string; role: string; model: string }>;
    enableVerdict: boolean;
  }>>;
}

export default function RightPanel({
  project,
  agents,
  selectedAgentId,
  onSelectAgent,
  isOpen,
  setIsOpen,
  activeTab,
  onTabChange,
  onProjectUpdate,
  previewContent,
  previewTitle,
  activeCanvasId,
  activeArtifactId,
  artifactCode,
  artifactTitle,
  artifactType,
  artifactVersion,
  onSelectPreset,
  panelWidth = 35,
  onPanelWidthChange,
  browserSession = null,
  councilMode,
  setCouncilMode,
  toolsState,
  setToolsState,
  councilConfig,
  setCouncilConfig
}: RightPanelProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [isPasting, setIsPasting] = useState(false);
  const [pastedText, setPastedText] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [dbNeedsMigration, setDbNeedsMigration] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);

  // Local fallbacks if props not passed (like in subagent workspace)
  const [localCouncilMode, setLocalCouncilMode] = useState(false);
  const [localToolsState, setLocalToolsState] = useState({
    webSearch: true,
    exaSearch: false,
    kaggle: false,
    database: false,
    rag: false
  });
  const [localCouncilConfig, setLocalCouncilConfig] = useState({
    seats: [
      { name: 'Creative', role: 'Creative Seat', model: 'google/gemini-pro-1.5' },
      { name: 'Critic', role: 'Critic Seat', model: 'openai/gpt-4o' },
      { name: 'Auditor', role: 'Auditor Seat', model: 'deepseek/deepseek-chat' },
      { name: 'General', role: 'General Seat', model: 'meta-llama/llama-3-70b-instruct' }
    ],
    enableVerdict: true
  });

  const effectiveCouncilMode = councilMode !== undefined ? councilMode : localCouncilMode;
  const setEffectiveCouncilMode = setCouncilMode !== undefined ? setCouncilMode : setLocalCouncilMode;
  
  const effectiveToolsState = toolsState !== undefined ? toolsState : localToolsState;
  const setEffectiveToolsState = setToolsState !== undefined ? setToolsState : setLocalToolsState;
  
  const effectiveCouncilConfig = councilConfig !== undefined ? councilConfig : localCouncilConfig;
  const setEffectiveCouncilConfig = setCouncilConfig !== undefined ? setCouncilConfig : setLocalCouncilConfig;
  
  const [isResizing, setIsResizing] = useState(false);
  const [isTabBarCollapsed, setIsTabBarCollapsed] = useState(true);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const isResizingRef = useRef(false);

  // Resize handle logic
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    isResizingRef.current = true;
    const startX = e.clientX;
    const startWidthPercent = panelWidth;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isResizingRef.current) return;
      const deltaX = startX - moveEvent.clientX;
      const deltaPercent = (deltaX / window.innerWidth) * 100;
      const newPercent = Math.min(70, Math.max(30, startWidthPercent + deltaPercent));
      onPanelWidthChange?.(Math.round(newPercent));
    };

    const handleMouseUp = () => {
      isResizingRef.current = false;
      setIsResizing(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [panelWidth, onPanelWidthChange]);

  if (!isOpen) {
    return null;
  }

  // Calculate stats
  const subAgentsCount = agents.filter(a => a.type === 'subagent').length;
  const orchestratorAgent = agents.find(a => a.type === 'orchestrator');

  const isCouncilActive = agents.some(a => 
    a.name.toLowerCase().includes('council') || 
    a.task?.toLowerCase().includes('council') ||
    a.task?.toLowerCase().includes('debate')
  );

  const sqlMigrationCode = `ALTER TABLE projects 
  ADD COLUMN IF NOT EXISTS master_resume TEXT,
  ADD COLUMN IF NOT EXISTS master_resume_filename TEXT;`;

  const copySqlToClipboard = () => {
    navigator.clipboard.writeText(sqlMigrationCode);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2000);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    setErrorMsg(null);
    setDbNeedsMigration(false);

    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const parseRes = await fetch('/api/parse', {
        method: 'POST',
        body: formData,
      });
      if (!parseRes.ok) throw new Error('Failed to parse file.');
      const parseData = await parseRes.json();
      
      const saveRes = await fetch(`/api/project/${project.id}/resume`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          masterResume: parseData.text,
          filename: file.name,
        }),
      });

      if (!saveRes.ok) {
        const errorData = await saveRes.json();
        if (errorData.error && (errorData.error.includes('column') || errorData.error.includes('exist'))) {
          setDbNeedsMigration(true);
          throw new Error('Supabase database is missing resume columns.');
        }
        throw new Error(errorData.error || 'Failed to save resume context.');
      }

      const saveData = await saveRes.json();
      if (onProjectUpdate) {
        onProjectUpdate(saveData.project);
      }
    } catch (err) {
      console.error(err);
      setErrorMsg(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handlePasteSubmit = async () => {
    if (!pastedText.trim()) return;
    setIsUploading(true);
    setErrorMsg(null);
    setDbNeedsMigration(false);

    try {
      const saveRes = await fetch(`/api/project/${project.id}/resume`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          masterResume: pastedText,
          filename: 'Pasted Resume',
        }),
      });

      if (!saveRes.ok) {
        const errorData = await saveRes.json();
        if (errorData.error && (errorData.error.includes('column') || errorData.error.includes('exist'))) {
          setDbNeedsMigration(true);
          throw new Error('Supabase database is missing resume columns.');
        }
        throw new Error(errorData.error || 'Failed to save resume context.');
      }

      const saveData = await saveRes.json();
      if (onProjectUpdate) {
        onProjectUpdate(saveData.project);
      }
      setIsPasting(false);
      setPastedText('');
    } catch (err) {
      console.error(err);
      setErrorMsg(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteResume = async () => {
    setIsUploading(true);
    setErrorMsg(null);
    try {
      const delRes = await fetch(`/api/project/${project.id}/resume`, {
        method: 'DELETE',
      });
      if (!delRes.ok) throw new Error('Failed to delete resume context.');
      const delData = await delRes.json();
      if (onProjectUpdate) {
        onProjectUpdate(delData.project);
      }
    } catch (err) {
      console.error(err);
      setErrorMsg(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div
      className={`h-full bg-[#F4F0EB] border-l border-[#E5E0DA] flex flex-col shrink-0 select-none font-dmsans overflow-hidden relative ${
        isResizing ? '' : 'transition-[width] duration-150'
      }`}
      style={{ width: `${panelWidth}%` }}
    >
      {/* Resize Handle */}
      <div
        className="resize-handle"
        onMouseDown={handleMouseDown}
      />

      {/* Top Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#E5E0DA] shrink-0 bg-[#F4F0EB]">
        <div className="flex items-center gap-2">
          {/* Back/Reveal Toggle Button */}
          {(activeTab === 'canvas' || activeTab === 'artifact' || activeTab === 'browser') && (
            <button
              type="button"
              onClick={() => setIsTabBarCollapsed(!isTabBarCollapsed)}
              className="p-1 hover:bg-[#E2DCD3] rounded text-[#85827D] hover:text-[#191919] transition-colors cursor-pointer"
              title={isTabBarCollapsed ? "Show tabs navigation" : "Collapse tabs navigation"}
            >
              {isTabBarCollapsed ? (
                <Plus className="w-3.5 h-3.5" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 rotate-180" />
              )}
            </button>
          )}
          <span className="text-[11px] font-bold text-[#191919] uppercase tracking-wider font-lora">
            Workspace
          </span>
        </div>
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          className="p-1 hover:bg-[#E9E3DB] rounded text-[#85827D] hover:text-[#191919] transition-colors cursor-pointer"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Icon Tab Bar */}
      {!(isTabBarCollapsed && (activeTab === 'canvas' || activeTab === 'artifact')) && (
        <div className="flex items-center justify-center gap-1 px-3 py-2 border-b border-[#E5E0DA] bg-[#F4F0EB] shrink-0 animate-slideDown">
          {[
            { key: 'agents' as const, icon: GitBranch, tooltip: 'Mind Network', dot: null },
            { key: 'tools' as const, icon: Sliders, tooltip: 'Connectors & Tools', dot: (effectiveCouncilMode || effectiveToolsState.webSearch || effectiveToolsState.exaSearch || effectiveToolsState.kaggle || effectiveToolsState.database || effectiveToolsState.rag) ? 'bg-emerald-500' : null },
            { key: 'files' as const, icon: Paperclip, tooltip: 'Files & Context', dot: null },
            { key: 'preview' as const, icon: Eye, tooltip: 'Live Preview', dot: null },
            { key: 'memory' as const, icon: Brain, tooltip: 'Project Memory', dot: null },
            {key: 'canvas' as const, icon: Table2, tooltip: 'Data Canvas', dot: activeCanvasId ? 'bg-emerald-500' : null },
            {key: 'artifact' as const, icon: Boxes, tooltip: 'Artifact Sandbox', dot: artifactCode ? 'bg-purple-500' : null },
            ...(isCouncilActive ? [{ key: 'council' as const, icon: Scale, tooltip: 'AI Council', dot: 'bg-amber-500' }] : []),
            ...(browserSession ? [{ key: 'browser' as const, icon: Globe, tooltip: 'Live Browser', dot: browserSession.status === 'active' ? 'bg-blue-500 animate-pulse' : null }] : []),
          ].map(({ key, icon: Icon, tooltip, dot }) => (
            <button
              key={key}
              type="button"
              onClick={() => onTabChange(key)}
              className={`icon-tab-tooltip relative flex items-center justify-center w-8 h-8 rounded-lg transition-all duration-150 cursor-pointer ${
                activeTab === key
                  ? 'bg-white text-[#191919] shadow-xs border border-[#E5E0DA]'
                  : 'text-[#85827D] hover:bg-[#E2DCD3]/50 hover:text-[#5E5B56] border border-transparent'
              }`}
              data-tooltip={tooltip}
            >
              <Icon className="w-4 h-4" />
              {dot && (
                <span className={`absolute top-1 right-1 w-[6px] h-[6px] rounded-full ${dot} ring-1 ring-[#F4F0EB]`} />
              )}
            </button>
          ))}
        </div>
      )}

      {/* Tab Contents */}
      <div className="flex-grow overflow-y-auto p-4 scroll-smooth flex flex-col">
        {activeTab === 'tools' && (
          <div id="workspace-tools-section" className="space-y-4 animate-fadeIn">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#85827D] uppercase tracking-wider mb-2 font-dmsans">
              <Sliders className="w-3.5 h-3.5" />
              <span>Connectors & Tools Config</span>
            </div>

            {/* 1. Context File Helper */}
            <div className="bg-[#FFFFFF] border border-[#E5E0DA] rounded-xl p-4 shadow-xs space-y-3">
              <div className="flex justify-between items-center">
                <h3 className="text-xs font-bold text-[#191919] uppercase tracking-wider font-lora">1. Master Context File</h3>
                <button
                  type="button"
                  onClick={() => onTabChange('files')}
                  className="text-[10px] text-primary hover:underline font-bold"
                >
                  Manage files →
                </button>
              </div>
              <p className="text-[11px] text-[#5E5B56] leading-relaxed">
                Add resume or project context files for the agents to analyze and use in their tasks.
              </p>
              {project.master_resume ? (
                <div className="bg-[#F5F9F6] border border-[#D1E7DD] p-2.5 rounded-lg flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="w-4 h-4 text-emerald-600" />
                    <span className="font-semibold text-xs text-ink truncate leading-tight">
                      {project.master_resume_filename || 'Uploaded Resume'}
                    </span>
                  </div>
                  <span className="text-[9px] text-emerald-600 font-bold uppercase tracking-tight">Active</span>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => onTabChange('files')}
                  className="w-full text-center py-2 border border-dashed border-[#C2BCB2] hover:bg-[#FDFBF9] text-xs font-semibold text-[#5E5B56] rounded-xl transition-colors cursor-pointer"
                >
                  + Upload Context File
                </button>
              )}
            </div>

            {/* 2. Connectors & Tools Toggles */}
            <div className="bg-[#FFFFFF] border border-[#E5E0DA] rounded-xl p-4 shadow-xs space-y-3">
              <h3 className="text-xs font-bold text-[#191919] uppercase tracking-wider font-lora">2. Integrations & Search</h3>
              <p className="text-[11px] text-[#5E5B56] leading-relaxed">
                Toggle external data sources, search engines, and local databases for model usage.
              </p>

              <div className="border border-[#F4F0EB] bg-[#FBF9F6]/50 rounded-xl p-1.5 space-y-1">
                {/* Web Search */}
                <div className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-[#F4F0EB]/60 transition-colors text-xs font-semibold text-[#191919]">
                  <div className="flex items-center gap-2.5">
                    <Database className="w-4 h-4 text-[#85827D]" />
                    <div className="flex flex-col">
                      <span>Tavily Web Search</span>
                      <span className="text-[10px] text-[#85827D] font-normal">Standard real-time google/bing search</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEffectiveToolsState(prev => ({ ...prev, webSearch: !prev.webSearch }))}
                    className={`w-9 h-5 rounded-full p-0.5 transition-colors duration-200 cursor-pointer ${
                      effectiveToolsState.webSearch ? 'bg-emerald-600' : 'bg-[#E5E0DA]'
                    }`}
                  >
                    <div className={`w-4 h-4 rounded-full bg-white transition-transform duration-200 ${
                      effectiveToolsState.webSearch ? 'translate-x-4' : 'translate-x-0'
                    }`} />
                  </button>
                </div>

                {/* Exa Search */}
                <div className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-[#F4F0EB]/60 transition-colors text-xs font-semibold text-[#191919]">
                  <div className="flex items-center gap-2.5">
                    <Database className="w-4 h-4 text-purple-600" />
                    <div className="flex flex-col">
                      <span>Exa Neural Search</span>
                      <span className="text-[10px] text-[#85827D] font-normal">Neural/embeddings web database</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEffectiveToolsState(prev => ({ ...prev, exaSearch: !prev.exaSearch }))}
                    className={`w-9 h-5 rounded-full p-0.5 transition-colors duration-200 cursor-pointer ${
                      effectiveToolsState.exaSearch ? 'bg-emerald-600' : 'bg-[#E5E0DA]'
                    }`}
                  >
                    <div className={`w-4 h-4 rounded-full bg-white transition-transform duration-200 ${
                      effectiveToolsState.exaSearch ? 'translate-x-4' : 'translate-x-0'
                    }`} />
                  </button>
                </div>

                {/* Kaggle */}
                <div className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-[#F4F0EB]/60 transition-colors text-xs font-semibold text-[#191919]">
                  <div className="flex items-center gap-2.5">
                    <Database className="w-4 h-4 text-blue-600" />
                    <div className="flex flex-col">
                      <span>Kaggle Datasets</span>
                      <span className="text-[10px] text-[#85827D] font-normal">Search and pull from Kaggle repository</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEffectiveToolsState(prev => ({ ...prev, kaggle: !prev.kaggle }))}
                    className={`w-9 h-5 rounded-full p-0.5 transition-colors duration-200 cursor-pointer ${
                      effectiveToolsState.kaggle ? 'bg-emerald-600' : 'bg-[#E5E0DA]'
                    }`}
                  >
                    <div className={`w-4 h-4 rounded-full bg-white transition-transform duration-200 ${
                      effectiveToolsState.kaggle ? 'translate-x-4' : 'translate-x-0'
                    }`} />
                  </button>
                </div>

                {/* Supabase SQL */}
                <div className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-[#F4F0EB]/60 transition-colors text-xs font-semibold text-[#191919]">
                  <div className="flex items-center gap-2.5">
                    <Database className="w-4 h-4 text-emerald-600" />
                    <div className="flex flex-col">
                      <span>Supabase PostgreSQL</span>
                      <span className="text-[10px] text-[#85827D] font-normal">Direct query execution & table management</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEffectiveToolsState(prev => ({ ...prev, database: !prev.database }))}
                    className={`w-9 h-5 rounded-full p-0.5 transition-colors duration-200 cursor-pointer ${
                      effectiveToolsState.database ? 'bg-emerald-600' : 'bg-[#E5E0DA]'
                    }`}
                  >
                    <div className={`w-4 h-4 rounded-full bg-white transition-transform duration-200 ${
                      effectiveToolsState.database ? 'translate-x-4' : 'translate-x-0'
                    }`} />
                  </button>
                </div>

                {/* Qdrant RAG */}
                <div className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-[#F4F0EB]/60 transition-colors text-xs font-semibold text-[#191919]">
                  <div className="flex items-center gap-2.5">
                    <Database className="w-4 h-4 text-amber-600" />
                    <div className="flex flex-col">
                      <span>Qdrant Vector RAG</span>
                      <span className="text-[10px] text-[#85827D] font-normal">Vector database semantic context retrieval</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEffectiveToolsState(prev => ({ ...prev, rag: !prev.rag }))}
                    className={`w-9 h-5 rounded-full p-0.5 transition-colors duration-200 cursor-pointer ${
                      effectiveToolsState.rag ? 'bg-emerald-600' : 'bg-[#E5E0DA]'
                    }`}
                  >
                    <div className={`w-4 h-4 rounded-full bg-white transition-transform duration-200 ${
                      effectiveToolsState.rag ? 'translate-x-4' : 'translate-x-0'
                    }`} />
                  </button>
                </div>
              </div>
            </div>

            {/* 3. AI Council Config */}
            <div className="bg-[#FFFFFF] border border-[#E5E0DA] rounded-xl p-4 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Brain className={`w-4.5 h-4.5 ${effectiveCouncilMode ? 'text-purple-600' : 'text-[#85827D]'}`} />
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-[#191919] uppercase tracking-wider font-lora">3. AI Council Mode</span>
                    <span className="text-[9px] text-purple-700 bg-purple-50 border border-purple-100 px-1 rounded-sm font-bold uppercase tracking-tight mt-0.5 self-start">Cross-LLM Debate</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setEffectiveCouncilMode(!effectiveCouncilMode)}
                  className={`w-9 h-5 rounded-full p-0.5 transition-colors duration-200 cursor-pointer ${
                    effectiveCouncilMode ? 'bg-[#5B39E0]' : 'bg-[#E5E0DA]'
                  }`}
                >
                  <div className={`w-4 h-4 rounded-full bg-white transition-transform duration-200 ${
                    effectiveCouncilMode ? 'translate-x-4' : 'translate-x-0'
                  }`} />
                </button>
              </div>

              {effectiveCouncilMode && (
                <div className="border border-[#F4F0EB] bg-[#FDFBF9] rounded-xl p-3 space-y-3 animate-fadeIn">
                  <div className="flex items-center justify-between pb-1 border-b border-[#F4F0EB]">
                    <span className="text-[10px] font-bold text-[#85827D] uppercase tracking-wider">
                      Council Seats ({effectiveCouncilConfig.seats.length})
                    </span>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={effectiveCouncilConfig.enableVerdict}
                        onChange={(e) => setEffectiveCouncilConfig(prev => ({ ...prev, enableVerdict: e.target.checked }))}
                        className="rounded text-purple-600 focus:ring-purple-500 w-3.5 h-3.5"
                      />
                      <span className="text-[10px] text-[#5E5B56] font-bold">Arbiter Verdict</span>
                    </label>
                  </div>
                  
                  <div className="space-y-2">
                    {effectiveCouncilConfig.seats.map((seat: any, index: number) => (
                      <div key={index} className="flex items-center gap-2 bg-white p-2 border border-[#EBE5DC] rounded-xl shadow-3xs">
                        <input
                          type="text"
                          value={seat.name}
                          onChange={(e) => {
                            const newSeats = [...effectiveCouncilConfig.seats];
                            newSeats[index] = { ...newSeats[index], name: e.target.value, role: `${e.target.value} Seat` };
                            setEffectiveCouncilConfig(prev => ({ ...prev, seats: newSeats }));
                          }}
                          className="w-20 text-xs bg-transparent border-0 border-b border-[#E5E0DA] focus:border-purple-500 px-1 py-0.5 font-bold text-[#191919] focus:outline-none"
                          placeholder="Seat name"
                        />
                        <select
                          value={seat.model}
                          onChange={(e) => {
                            const newSeats = [...effectiveCouncilConfig.seats];
                            newSeats[index] = { ...newSeats[index], model: e.target.value };
                            setEffectiveCouncilConfig(prev => ({ ...prev, seats: newSeats }));
                          }}
                          className="flex-grow text-[11px] bg-transparent border border-[#E5E0DA] rounded-lg px-2 py-1 font-medium text-[#5E5B56] focus:outline-none max-w-[150px] truncate"
                        >
                          {AVAILABLE_MODELS.map((model) => (
                            <option key={model.id} value={model.id}>
                              {model.name}
                            </option>
                          ))}
                        </select>
                        {effectiveCouncilConfig.seats.length > 2 && (
                          <button
                            type="button"
                            onClick={() => {
                              const newSeats = effectiveCouncilConfig.seats.filter((_: any, i: number) => i !== index);
                              setEffectiveCouncilConfig(prev => ({ ...prev, seats: newSeats }));
                            }}
                            className="p-1 text-red-500 hover:bg-red-50 rounded-lg text-sm transition-colors font-bold"
                            title="Remove seat"
                          >
                            ×
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  {effectiveCouncilConfig.seats.length < 6 && (
                    <button
                      type="button"
                      onClick={() => {
                        const newSeat = {
                          name: `Seat ${effectiveCouncilConfig.seats.length + 1}`,
                          role: `Seat ${effectiveCouncilConfig.seats.length + 1} Seat`,
                          model: AVAILABLE_MODELS[0].id
                        };
                        setEffectiveCouncilConfig(prev => ({ ...prev, seats: [...prev.seats, newSeat] }));
                      }}
                      className="w-full text-center py-2 border border-dashed border-[#C2BCB2] hover:bg-[#F4F0EB] text-xs font-bold text-[#5E5B56] rounded-xl transition-colors cursor-pointer"
                    >
                      + Add Seat to Council
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'council' && (
          <div id="workspace-council-section" className="flex-grow flex flex-col h-full min-h-[400px] overflow-hidden">
            <CouncilDebateView agents={agents} projectId={project.id} />
          </div>
        )}
        {activeTab === 'preview' && (
          <div id="workspace-preview-section" className="flex-1 flex flex-col gap-3 animate-fadeIn h-full overflow-hidden min-h-[400px]">
            <div className="flex items-center justify-between text-[11px] font-bold text-[#85827D] uppercase tracking-wider font-dmsans shrink-0">
              <span>{previewTitle || 'Live Preview'}</span>
            </div>
            
            {previewContent ? (
              <div className="flex-1 border border-[#E5E0DA] bg-white rounded-xl overflow-hidden shadow-2xs flex flex-col min-h-0">
                <iframe
                  title="Live Preview Sandbox"
                  sandbox="allow-scripts allow-popups allow-modals"
                  srcDoc={previewContent}
                  className="w-full h-full flex-1 border-0 bg-white"
                />
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-xs text-[#85827D] italic border border-dashed border-[#E5E0DA] rounded-xl bg-white/50 flex-grow justify-center">
                <p>No preview content loaded.</p>
                <p className="mt-1.5 font-normal text-[10px] leading-relaxed">
                  Click "View Preview" on any HTML/SVG code block in the chat to render it here.
                </p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'canvas' && (
          <div id="workspace-canvas-section" className="flex-grow flex flex-col h-full min-h-[400px] overflow-hidden">
            {activeCanvasId ? (
              <LiveDataCanvas canvasId={activeCanvasId} />
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-xs text-[#85827D] italic border border-dashed border-[#E5E0DA] rounded-xl bg-white/50 justify-center">
                <p>No active spreadsheet loaded.</p>
                <p className="mt-1.5 font-normal text-[10px] leading-relaxed">
                  Start a research request (e.g. "Research top 10 SaaS companies") to generate a live data spreadsheet.
                </p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'browser' && (
          <div id="workspace-browser-section" className="flex-grow flex flex-col h-full min-h-[400px] overflow-hidden">
            <LiveBrowser session={browserSession} />
          </div>
        )}

        {activeTab === 'artifact' && (
          <div id="workspace-artifact-section" className="flex-grow flex flex-col h-full min-h-[400px] overflow-hidden gap-2">
            {artifactCode ? (
              <div className="flex-grow flex flex-col h-full min-h-0 bg-white border border-[#E5E0DA] rounded-xl overflow-hidden shadow-2xs">
                <ArtifactToolbar
                  code={artifactCode}
                  title={artifactTitle || 'Visual Component'}
                  type={artifactType || 'app'}
                  version={artifactVersion || 1}
                />
                <div className="flex-grow min-h-0 relative">
                  <ArtifactRenderer
                    code={artifactCode}
                    title={artifactTitle || 'Visual Component'}
                  />
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col justify-start">
                <ArtifactPicker onSelectPreset={onSelectPreset || (() => {})} />
              </div>
            )}
          </div>
        )}

        {activeTab === 'agents' && (
          <div id="workspace-agents-section" className="space-y-4 animate-fadeIn flex flex-col">
            <div className="bg-[#FFFFFF] border border-[#E5E0DA] rounded-xl p-4 shadow-xs space-y-2 select-text">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <NeuralSymbol 
                    state={agents.some(a => a.status === 'running') ? 'execution' : 'thinking'} 
                    size={16} 
                    className="shrink-0" 
                  />
                  <span className="text-xs font-bold text-[#191919] uppercase tracking-wider font-lora">
                    MIND NETWORK
                  </span>
                </div>
                <span className="text-[9px] bg-[#cc785c]/10 text-[#cc785c] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider select-none">
                  Mission Control
                </span>
              </div>
              <p className="text-[11px] text-[#5E5B56] leading-relaxed">
                Observe specialized minds collaborating on your goal. Watch tool execution and token metrics in real-time.
              </p>
            </div>
            
            <AgentTree
              agents={agents}
              selectedAgentId={selectedAgentId}
              onSelectAgent={onSelectAgent}
            />
          </div>
        )}

        {activeTab === 'files' && (
          <div id="workspace-files-section" className="space-y-4">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#85827D] uppercase tracking-wider mb-2 font-dmsans">
              <Paperclip className="w-3.5 h-3.5" />
              <span>FILES & CONTEXT</span>
            </div>

            {/* ERROR ALERT */}
            {errorMsg && (
              <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-xl text-xs flex items-start gap-2 animate-fadeIn">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-500 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-semibold">Error Occurred</p>
                  <p className="opacity-90">{errorMsg}</p>
                </div>
              </div>
            )}

            {/* DATABASE ALTERATION HELPER */}
            {dbNeedsMigration && (
              <div className="bg-amber-50 border border-amber-250 text-amber-900 p-3 rounded-xl text-xs space-y-2 animate-fadeIn">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
                  <div>
                    <p className="font-semibold">Database Schema Alteration Required</p>
                    <p className="text-[11px] opacity-80 leading-relaxed mt-0.5">
                      Supabase needs the resume columns. Copy this SQL query and execute it inside your Supabase dashboard SQL Editor:
                    </p>
                  </div>
                </div>
                <div className="relative bg-[#1E1E1E] text-neutral-300 p-2 rounded-lg font-mono text-[9px] select-text break-all">
                  <button
                    onClick={copySqlToClipboard}
                    className="absolute top-1.5 right-1.5 p-1 bg-neutral-800 hover:bg-neutral-700 rounded text-neutral-400 hover:text-white transition-colors cursor-pointer"
                    title="Copy to clipboard"
                  >
                    {copiedSql ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                  </button>
                  <pre className="overflow-x-auto whitespace-pre">{sqlMigrationCode}</pre>
                </div>
              </div>
            )}

            {/* IF MASTER RESUME EXISTS */}
            {project.master_resume ? (
              <div className="space-y-3 animate-fadeIn">
                <div className="bg-canvas border border-hairline rounded-xl p-3.5 shadow-xs space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="bg-success/10 border border-success/20 p-1.5 rounded-lg shrink-0">
                        <FileText className="w-4 h-4 text-success" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-xs text-ink truncate leading-tight">
                          {project.master_resume_filename || 'Uploaded Resume'}
                        </p>
                        <span className="text-[10px] text-success bg-success/10 border border-success/20 px-1.5 py-0.5 rounded font-medium inline-block mt-1">
                          Resume Active
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={handleDeleteResume}
                      disabled={isUploading}
                      className="p-1.5 hover:bg-rose-50 hover:text-rose-600 rounded text-muted transition-all cursor-pointer disabled:opacity-50 shrink-0"
                      title="Delete resume context"
                    >
                      {isUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                    </button>
                  </div>

                  <div className="border-t border-hairline/60 pt-3">
                    <span className="text-[10px] font-bold text-muted uppercase tracking-wider block mb-1.5">
                      Parsed Text Preview
                    </span>
                    <div className="bg-surface-soft border border-hairline rounded-lg p-2.5 max-h-[220px] overflow-y-auto text-[11px] leading-relaxed text-muted font-lora select-text scrollbar-thin">
                      {project.master_resume}
                    </div>
                  </div>
                </div>

                <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-[11px] text-[#8c6d3f] flex gap-2 leading-relaxed">
                  <AlertCircle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
                  <p>
                    Agents will automatically access this master resume context during job searches and tailoring cycles.
                  </p>
                </div>
              </div>
            ) : (
              /* IF NO MASTER RESUME EXISTS */
              <div className="space-y-3">
                {isPasting ? (
                  /* PASTE TEXTAREA MODE */
                  <div className="bg-canvas border border-hairline rounded-xl p-3 space-y-3 shadow-xs animate-fadeIn">
                    <span className="text-[10px] font-bold text-muted uppercase tracking-wider block">
                      Paste Master Resume
                    </span>
                    <textarea
                      value={pastedText}
                      onChange={(e) => setPastedText(e.target.value)}
                      placeholder="Paste your resume text here (experience, skills, contacts, education...)"
                      rows={8}
                      className="w-full bg-surface-card border border-hairline rounded-lg p-2.5 text-xs leading-relaxed text-ink focus:outline-hidden focus:border-primary/50 font-lora resize-none"
                    />
                    <div className="flex gap-2 justify-end">
                      <button
                        type="button"
                        onClick={() => {
                          setIsPasting(false);
                          setPastedText('');
                          setErrorMsg(null);
                        }}
                        className="px-3 py-1.5 text-xs text-muted hover:bg-surface-soft rounded-lg border border-hairline transition-colors cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handlePasteSubmit}
                        disabled={isUploading || !pastedText.trim()}
                        className="px-3 py-1.5 text-xs bg-primary hover:bg-primary-active text-white rounded-lg transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5 font-semibold"
                      >
                        {isUploading ? (
                          <>
                            <Loader2 className="w-3 h-3 animate-spin" />
                            <span>Saving...</span>
                          </>
                        ) : (
                          <>
                            <Check className="w-3 h-3" />
                            <span>Save Context</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                ) : (
                  /* DROP/UPLOAD ZONE MODE */
                  <div className="bg-canvas border border-hairline rounded-xl p-6 text-center shadow-xs space-y-4">
                    <div className="flex flex-col items-center gap-1 text-xs text-muted">
                      <div className="bg-surface-soft border border-hairline p-3 rounded-full mb-1.5">
                        <Upload className="w-6 h-6 text-muted" />
                      </div>
                      <p className="font-bold text-ink font-dmsans">Upload Master Resume</p>
                      <p className="text-[11px] text-muted leading-relaxed max-w-[190px] mt-0.5">
                        Upload your PDF, TXT, or MD resume. L3 agents will tailor it for targeted jobs.
                      </p>
                    </div>

                    <div className="flex flex-col gap-2 w-full max-w-[200px] mx-auto pt-2">
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileUpload}
                        accept=".pdf,.txt,.md"
                        className="hidden"
                      />
                      
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploading}
                        className="w-full text-xs bg-primary hover:bg-primary-active text-white rounded-full py-2 hover:bg-opacity-90 transition-all cursor-pointer font-semibold shadow-xs flex items-center justify-center gap-1.5"
                      >
                        {isUploading ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Parsing PDF...</span>
                          </>
                        ) : (
                          <>
                            <Upload className="w-3.5 h-3.5" />
                            <span>Upload File</span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => setIsPasting(true)}
                        disabled={isUploading}
                        className="w-full text-xs bg-canvas text-muted hover:text-ink border border-hairline rounded-full py-2 hover:bg-surface-card transition-all cursor-pointer font-semibold"
                      >
                        Paste Resume Text
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'memory' && (
          <div id="workspace-memory-section" className="space-y-4">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#85827D] uppercase tracking-wider mb-2 font-dmsans">
              <Pin className="w-3.5 h-3.5" />
              <span>PROJECT MEMORY</span>
            </div>
            <div className="bg-[#FFFFFF] border border-[#E5E0DA] rounded-xl p-4 text-xs space-y-3 shadow-xs">
              <div className="space-y-1">
                <span className="font-bold text-[#85827D] uppercase text-[10px] tracking-wider block">Goal:</span>
                <p className="text-[#191919] font-semibold text-sm leading-relaxed font-lora">{project.goal}</p>
              </div>
              
              {orchestratorAgent && (
                <div className="space-y-2 border-t border-[#E5E0DA] pt-3">
                  <div className="flex justify-between items-center">
                    <span className="text-[#5E5B56] font-medium">Orchestrator:</span>
                    <span className="text-[#191919] font-bold">{orchestratorAgent.name}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[#5E5B56] font-medium">Pipeline Model:</span>
                    <span className="text-[#191919] font-semibold truncate max-w-[120px]">{orchestratorAgent.model || 'DeepSeek V3'}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[#5E5B56] font-medium">Sub-agents Spawned:</span>
                    <span className="text-[#191919] font-semibold">{subAgentsCount} spawned</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[#5E5B56] font-medium">Total Status:</span>
                    <span className="text-emerald-700 bg-emerald-100 border border-emerald-250 px-2.5 py-0.5 rounded-full font-bold text-[10px]">
                      Active
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
