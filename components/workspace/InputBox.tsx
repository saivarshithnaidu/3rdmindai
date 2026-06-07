'use client';

import React, { useState } from 'react';
import { ArrowUp, Plus, FileText, X, Brain, Table2, Boxes, Globe, Loader2 } from 'lucide-react';
import ModelSelector from './ModelSelector';

interface InputBoxProps {
  onSubmit: (content: string, model: string, options?: any) => void;
  isLoading: boolean;
  selectedModel: string;
  onModelChange: (model: string) => void;
  placeholder?: string;
  disabled?: boolean;
  projectId?: string;
  onFileUploaded?: (text: string, filename: string) => void;
  inputValue?: string;
  onInputValueChange?: (val: string) => void;
  activeCanvasId?: string | null;
  activeArtifactId?: string | null;
  onOpenBrowserPicker?: () => void;
  
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
  onToggleToolsPanel?: () => void;
  isToolsPanelActive?: boolean;
}

export default function InputBox({
  onSubmit,
  isLoading,
  selectedModel,
  onModelChange,
  placeholder = "Reply...",
  disabled = false,
  projectId,
  onFileUploaded,
  inputValue,
  onInputValueChange,
  activeCanvasId,
  activeArtifactId,
  onOpenBrowserPicker,
  councilMode,
  setCouncilMode,
  toolsState,
  setToolsState,
  councilConfig,
  setCouncilConfig,
  onToggleToolsPanel,
  isToolsPanelActive = false
}: InputBoxProps) {
  const [localValue, setLocalValue] = useState('');
  const value = inputValue !== undefined ? inputValue : localValue;
  const setValue = onInputValueChange !== undefined ? onInputValueChange : setLocalValue;
  const [attachment, setAttachment] = useState<{ name: string; content: string } | null>(null);

  // Local fallbacks if props not passed (like in subagent chat)
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
  const effectiveToolsState = toolsState !== undefined ? toolsState : localToolsState;
  const effectiveCouncilConfig = councilConfig !== undefined ? councilConfig : localCouncilConfig;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!value.trim() && !attachment) return;
    
    let finalValue = value;
    if (attachment) {
      finalValue = `[Pasted Context File: ${attachment.name}]\n\`\`\`\n${attachment.content}\n\`\`\`\n\n${value}`;
    }

    onSubmit(finalValue, selectedModel, { 
      councilMode: effectiveCouncilMode, 
      councilConfig: effectiveCouncilConfig, 
      ...effectiveToolsState 
    });
    setValue('');
    setAttachment(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const text = e.clipboardData.getData('text');
    if (text.length > 800) {
      e.preventDefault();
      let filename = 'pasted_text.txt';
      const trimmed = text.trim();
      if (trimmed.startsWith('<!DOCTYPE html>') || trimmed.startsWith('<html') || (trimmed.includes('<script') && trimmed.includes('</script>'))) {
        filename = 'pasted_code.html';
      } else if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
        filename = 'pasted_data.json';
      }
      setAttachment({
        name: filename,
        content: text
      });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full bg-[#FBF9F6] px-4 pt-3 pb-2 border-t border-[#E5E0DA] select-none font-dmsans">
      <div className="relative bg-[#FFFFFF] border border-[#E5E0DA] rounded-2xl p-3 transition-all duration-200 focus-within:border-[#C2BCB2] focus-within:ring-3 focus-within:ring-[#C2BCB2]/10 max-w-4xl mx-auto shadow-xs flex flex-col gap-2">
        {attachment && (
          <div className="flex items-center gap-2 p-1.5 px-3 bg-[#FAF8F5] border border-[#E5E0DA] rounded-xl self-start text-xs text-[#191919] font-medium shadow-3xs animate-fadeIn max-w-max select-none">
            <FileText className="w-4 h-4 text-[#85827D]" />
            <span className="truncate max-w-[150px]">{attachment.name}</span>
            <span className="text-[10px] text-[#85827D] font-normal">({(attachment.content.length / 1024).toFixed(1)} KB)</span>
            <button
              type="button"
              onClick={() => setAttachment(null)}
              className="ml-1 p-0.5 hover:bg-[#EBE5DC] rounded text-[#85827D] hover:text-[#191919] transition-colors cursor-pointer"
              title="Remove attachment"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Active Mode Status Chips */}
        {(effectiveCouncilMode || activeCanvasId || activeArtifactId || effectiveToolsState.webSearch) && (
          <div className="flex items-center gap-1.5 flex-wrap animate-fadeIn">
            {effectiveCouncilMode && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                <Brain className="w-3 h-3" />
                Council
              </span>
            )}
            {activeCanvasId && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                <Table2 className="w-3 h-3" />
                Canvas
              </span>
            )}
            {activeArtifactId && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-50 text-purple-800 border border-purple-200">
                <Boxes className="w-3 h-3" />
                Artifact
              </span>
            )}
            {effectiveToolsState.webSearch && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-800 border border-blue-200">
                <Globe className="w-3 h-3" />
                Web
              </span>
            )}
          </div>
        )}

        <textarea
          rows={2}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder={isLoading ? "3RDMIND is thinking..." : placeholder}
          className="w-full bg-transparent border-0 text-[#191919] text-sm placeholder-[#85827D] resize-none focus:outline-none disabled:opacity-50"
          disabled={isLoading || disabled}
        />
        
        <div className="flex items-center justify-between mt-1 pt-1 relative border-t border-[#FBF9F6]">
          {/* Left Actions - Add attachment '+' icon to open Connectors & Tools panel */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onToggleToolsPanel}
              disabled={isLoading || disabled}
              className={`flex items-center justify-center p-1.5 rounded-full border text-[#85827D] hover:bg-[#F4F0EB] hover:text-[#191919] transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                isToolsPanelActive ? 'bg-[#F4F0EB] text-[#191919] border-[#C2BCB2]' : 'border-[#E5E0DA]'
              }`}
              title="Attachment options & tools"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>

            {onOpenBrowserPicker && (
              <button
                type="button"
                onClick={onOpenBrowserPicker}
                disabled={isLoading || disabled}
                className="flex items-center justify-center p-1.5 rounded-full border border-[#E5E0DA] text-[#85827D] hover:bg-[#F4F0EB] hover:text-[#191919] transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                title="Open browser agent"
              >
                <Globe className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Right Actions - Model Selector + Submit Button */}
          <div className="flex items-center gap-2">
            {/* Model Selector Dropdown */}
            <ModelSelector
              value={selectedModel}
              onChange={onModelChange}
              disabled={isLoading || disabled}
            />

            {/* Submit button */}
            <button
              type="submit"
              disabled={(!value.trim() && !attachment) || isLoading || disabled}
              className={`flex items-center justify-center rounded-full p-2.5 transition-colors cursor-pointer ${
                ((!value.trim() && !attachment) || isLoading || disabled)
                  ? 'bg-[#e6dfd8] text-[#8e8b82] cursor-not-allowed'
                  : 'bg-primary hover:bg-primary-active text-white hover:shadow-md hover:shadow-primary/10'
              }`}
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin text-[#8e8b82]" />
              ) : (
                <ArrowUp className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
      </div>
      <p className="text-[10px] text-[#85827D] text-center mt-1.5 font-semibold select-none leading-none opacity-80">
        3RDMIND can make mistakes. Please double-check important info.
      </p>
    </form>
  );
}
