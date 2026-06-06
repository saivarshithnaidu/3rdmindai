'use client';

import React, { useEffect, useRef, useState } from 'react';
import { 
  Paperclip, 
  Users, 
  Search, 
  Database, 
  FileText, 
  Boxes, 
  ChevronRight,
  Loader2,
  Check
} from 'lucide-react';

import { AVAILABLE_MODELS } from '../../lib/constants';
import { CouncilConfig } from '../../types';

interface PopoverMenuProps {
  isOpen: boolean;
  onClose: () => void;
  councilMode: boolean;
  setCouncilMode: (val: boolean) => void;
  toolsState: {
    webSearch: boolean;
    exaSearch: boolean;
    kaggle: boolean;
    database: boolean;
    rag: boolean;
  };
  setToolsState: React.Dispatch<React.SetStateAction<{
    webSearch: boolean;
    exaSearch: boolean;
    kaggle: boolean;
    database: boolean;
    rag: boolean;
  }>>;
  onFileUploaded?: (text: string, filename: string) => void;
  projectId?: string;
  councilConfig: CouncilConfig;
  setCouncilConfig: React.Dispatch<React.SetStateAction<CouncilConfig>>;
}

export default function PopoverMenu({
  isOpen,
  onClose,
  councilMode,
  setCouncilMode,
  toolsState,
  setToolsState,
  onFileUploaded,
  projectId,
  councilConfig,
  setCouncilConfig
}: PopoverMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [showConnectors, setShowConnectors] = useState(false);

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleToggleTool = (key: keyof typeof toolsState) => {
    setToolsState(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const parseRes = await fetch('/api/parse', {
        method: 'POST',
        body: formData,
      });
      if (!parseRes.ok) throw new Error('Failed to parse file.');
      const parseData = await parseRes.json();
      
      // If projectId is provided, update project resume context directly
      if (projectId) {
        const saveRes = await fetch(`/api/project/${projectId}/resume`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            masterResume: parseData.text,
            filename: file.name,
          }),
        });
        if (!saveRes.ok) {
          const errData = await saveRes.json().catch(() => ({}));
          let msg = errData.error || 'Failed to save resume context.';
          if (msg.includes('column') || msg.includes('exist')) {
            msg += '\n\nNote: Your database table "projects" is missing the master_resume columns. Please open the Right Panel -> Artifacts tab to view and execute the SQL migration script to add these columns.';
          }
          throw new Error(msg);
        }
      }
      
      // Trigger callback if provided
      if (onFileUploaded) {
        onFileUploaded(parseData.text, file.name);
      }
      
      alert(`File parsed successfully: ${file.name}`);
      onClose();
    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : 'File upload failed');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <div 
      ref={menuRef}
      className="absolute bottom-12 left-0 mb-2 w-64 bg-[#FFFFFF] border border-[#E5E0DA] rounded-2xl shadow-xl z-50 p-2 font-dmsans select-none animate-fadeIn"
    >
      <div className="flex flex-col gap-0.5">
        {/* 1. Upload File */}
        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={handleFileChange}
          accept=".pdf,.txt,.md" 
          className="hidden" 
        />
        
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-[#191919] hover:bg-[#F4F0EB] transition-colors cursor-pointer text-left disabled:opacity-50"
        >
          {isUploading ? (
            <Loader2 className="w-4 h-4 animate-spin text-[#85827D]" />
          ) : (
            <Paperclip className="w-4 h-4 text-[#85827D]" />
          )}
          <div className="flex flex-col">
            <span>{isUploading ? 'Parsing file...' : 'Add context file'}</span>
            <span className="text-[10px] text-[#85827D] font-normal leading-tight mt-0.5">Upload PDF, TXT, or MD</span>
          </div>
        </button>

        <div className="h-px bg-[#F4F0EB] my-1" />

        {/* 2. AI Council (Cross-LLM) Toggle */}
        <div className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-[#F4F0EB] transition-colors">
          <div className="flex items-center gap-2.5 min-w-0">
            <Users className={`w-4 h-4 ${councilMode ? 'text-purple-600' : 'text-[#85827D]'}`} />
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-semibold text-[#191919]">AI Council Mode</span>
              <span className="text-[9px] text-purple-700 bg-purple-50 border border-purple-100 px-1 rounded-sm font-bold uppercase tracking-tight mt-0.5 self-start">Cross-LLM Debate</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setCouncilMode(!councilMode)}
            className={`w-8 h-4.5 rounded-full p-0.5 transition-colors duration-200 cursor-pointer focus:outline-none ${
              councilMode ? 'bg-[#5B39E0]' : 'bg-[#E5E0DA]'
            }`}
          >
            <div className={`w-3.5 h-3.5 rounded-full bg-white transition-transform duration-200 ${
              councilMode ? 'translate-x-3.5' : 'translate-x-0'
            }`} />
          </button>
        </div>

        {councilMode && (
          <div className="px-3 py-2 border-t border-b border-[#F4F0EB] space-y-2 max-h-56 overflow-y-auto bg-[#FDFBF9] rounded-lg m-1 shadow-inner">
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-bold text-[#85827D] uppercase tracking-wider block">
                Council Seats ({councilConfig.seats.length})
              </span>
              <label className="flex items-center gap-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={councilConfig.enableVerdict}
                  onChange={(e) => setCouncilConfig({ ...councilConfig, enableVerdict: e.target.checked })}
                  className="rounded text-purple-600 focus:ring-purple-500 w-3 h-3"
                />
                <span className="text-[9px] text-[#5E5B56] font-semibold">Arbiter Verdict</span>
              </label>
            </div>
            <div className="space-y-1.5">
              {councilConfig.seats.map((seat, index) => (
                <div key={index} className="flex items-center gap-1 bg-white p-1.5 border border-[#EBE5DC] rounded-xl shadow-3xs group">
                  <input
                    type="text"
                    value={seat.name}
                    onChange={(e) => {
                      const newSeats = [...councilConfig.seats];
                      newSeats[index] = { ...newSeats[index], name: e.target.value, role: `${e.target.value} Seat` };
                      setCouncilConfig({ ...councilConfig, seats: newSeats });
                    }}
                    className="w-16 text-[10px] bg-transparent border-0 border-b border-[#E5E0DA] focus:border-purple-500 px-0.5 py-0.5 font-bold text-[#191919] focus:outline-none"
                    placeholder="Seat name"
                  />
                  <select
                    value={seat.model}
                    onChange={(e) => {
                      const newSeats = [...councilConfig.seats];
                      newSeats[index] = { ...newSeats[index], model: e.target.value };
                      setCouncilConfig({ ...councilConfig, seats: newSeats });
                    }}
                    className="flex-grow text-[9px] bg-transparent border border-[#E5E0DA] rounded-md px-1 py-0.5 font-medium text-[#5E5B56] focus:outline-none max-w-[110px] truncate"
                  >
                    {AVAILABLE_MODELS.map((model) => (
                      <option key={model.id} value={model.id}>
                        {model.name}
                      </option>
                    ))}
                  </select>
                  {councilConfig.seats.length > 2 && (
                    <button
                      type="button"
                      onClick={() => {
                        const newSeats = councilConfig.seats.filter((_, i) => i !== index);
                        setCouncilConfig({ ...councilConfig, seats: newSeats });
                      }}
                      className="p-0.5 text-red-500 hover:bg-red-50 rounded-md text-xs transition-colors"
                      title="Remove seat"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>
            
            {councilConfig.seats.length < 6 && (
              <button
                type="button"
                onClick={() => {
                  const newSeat = {
                    name: `Seat ${councilConfig.seats.length + 1}`,
                    role: `Seat ${councilConfig.seats.length + 1} Seat`,
                    model: AVAILABLE_MODELS[0].id
                  };
                  setCouncilConfig({ ...councilConfig, seats: [...councilConfig.seats, newSeat] });
                }}
                className="w-full text-center py-1 border border-dashed border-[#C2BCB2] hover:bg-[#F4F0EB] hover:text-[#191919] text-[9px] font-bold text-[#5E5B56] rounded-lg transition-colors cursor-pointer"
              >
                + Add Seat
              </button>
            )}
          </div>
        )}

        <div className="h-px bg-[#F4F0EB] my-1" />

        {/* 3. Connectors Submenu Toggle */}
        <button
          type="button"
          onClick={() => setShowConnectors(!showConnectors)}
          className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold text-[#191919] hover:bg-[#F4F0EB] transition-colors cursor-pointer text-left"
        >
          <div className="flex items-center gap-2.5">
            <Boxes className="w-4 h-4 text-[#85827D]" />
            <span>Connectors & Tools</span>
          </div>
          <ChevronRight className={`w-4 h-4 text-[#85827D] transition-transform duration-200 ${
            showConnectors ? 'rotate-90' : ''
          }`} />
        </button>

        {/* 4. Connectors list (collapsible) */}
        {showConnectors && (
          <div className="bg-[#FBF9F6]/50 border border-[#F4F0EB] rounded-xl mt-1 p-1 space-y-0.5 animate-fadeIn">
            {/* Web Search */}
            <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-[#F4F0EB] transition-colors text-[11px] font-medium text-[#5E5B56]">
              <div className="flex items-center gap-2">
                <Search className="w-3.5 h-3.5 text-[#85827D]" />
                <span>Tavily Web Search</span>
              </div>
              <button
                type="button"
                onClick={() => handleToggleTool('webSearch')}
                className={`w-7 h-4 rounded-full p-0.5 transition-colors duration-200 cursor-pointer ${
                  toolsState.webSearch ? 'bg-emerald-600' : 'bg-[#E5E0DA]'
                }`}
              >
                <div className={`w-3 h-3 rounded-full bg-white transition-transform duration-200 ${
                  toolsState.webSearch ? 'translate-x-3' : 'translate-x-0'
                }`} />
              </button>
            </div>

            {/* Exa Neural */}
            <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-[#F4F0EB] transition-colors text-[11px] font-medium text-[#5E5B56]">
              <div className="flex items-center gap-2">
                <Search className="w-3.5 h-3.5 text-purple-600" />
                <span>Exa Neural Search</span>
              </div>
              <button
                type="button"
                onClick={() => handleToggleTool('exaSearch')}
                className={`w-7 h-4 rounded-full p-0.5 transition-colors duration-200 cursor-pointer ${
                  toolsState.exaSearch ? 'bg-emerald-600' : 'bg-[#E5E0DA]'
                }`}
              >
                <div className={`w-3 h-3 rounded-full bg-white transition-transform duration-200 ${
                  toolsState.exaSearch ? 'translate-x-3' : 'translate-x-0'
                }`} />
              </button>
            </div>

            {/* Kaggle */}
            <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-[#F4F0EB] transition-colors text-[11px] font-medium text-[#5E5B56]">
              <div className="flex items-center gap-2">
                <Database className="w-3.5 h-3.5 text-blue-600" />
                <span>Kaggle Datasets</span>
              </div>
              <button
                type="button"
                onClick={() => handleToggleTool('kaggle')}
                className={`w-7 h-4 rounded-full p-0.5 transition-colors duration-200 cursor-pointer ${
                  toolsState.kaggle ? 'bg-emerald-600' : 'bg-[#E5E0DA]'
                }`}
              >
                <div className={`w-3 h-3 rounded-full bg-white transition-transform duration-200 ${
                  toolsState.kaggle ? 'translate-x-3' : 'translate-x-0'
                }`} />
              </button>
            </div>

            {/* Supabase SQL */}
            <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-[#F4F0EB] transition-colors text-[11px] font-medium text-[#5E5B56]">
              <div className="flex items-center gap-2">
                <FileText className="w-3.5 h-3.5 text-emerald-600" />
                <span>Supabase PostgreSQL</span>
              </div>
              <button
                type="button"
                onClick={() => handleToggleTool('database')}
                className={`w-7 h-4 rounded-full p-0.5 transition-colors duration-200 cursor-pointer ${
                  toolsState.database ? 'bg-emerald-600' : 'bg-[#E5E0DA]'
                }`}
              >
                <div className={`w-3 h-3 rounded-full bg-white transition-transform duration-200 ${
                  toolsState.database ? 'translate-x-3' : 'translate-x-0'
                }`} />
              </button>
            </div>

            {/* Qdrant RAG */}
            <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-[#F4F0EB] transition-colors text-[11px] font-medium text-[#5E5B56]">
              <div className="flex items-center gap-2">
                <Boxes className="w-3.5 h-3.5 text-amber-600" />
                <span>Qdrant Vector RAG</span>
              </div>
              <button
                type="button"
                onClick={() => handleToggleTool('rag')}
                className={`w-7 h-4 rounded-full p-0.5 transition-colors duration-200 cursor-pointer ${
                  toolsState.rag ? 'bg-emerald-600' : 'bg-[#E5E0DA]'
                }`}
              >
                <div className={`w-3 h-3 rounded-full bg-white transition-transform duration-200 ${
                  toolsState.rag ? 'translate-x-3' : 'translate-x-0'
                }`} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
