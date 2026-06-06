'use client';

import React, { useState } from 'react';
import { ArrowUp, Plus, FileText, X, Brain, Table2, Boxes, Globe } from 'lucide-react';
import ModelSelector from './ModelSelector';
import PopoverMenu from './PopoverMenu';

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
  activeArtifactId
}: InputBoxProps) {
  const [localValue, setLocalValue] = useState('');
  const value = inputValue !== undefined ? inputValue : localValue;
  const setValue = onInputValueChange !== undefined ? onInputValueChange : setLocalValue;
  const [showMenu, setShowMenu] = useState(false);
  const [councilMode, setCouncilMode] = useState(false);
  const [attachment, setAttachment] = useState<{ name: string; content: string } | null>(null);
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!value.trim() && !attachment) return;
    
    let finalValue = value;
    if (attachment) {
      finalValue = `[Pasted Context File: ${attachment.name}]\n\`\`\`\n${attachment.content}\n\`\`\`\n\n${value}`;
    }

    onSubmit(finalValue, selectedModel, { councilMode, councilConfig, ...toolsState });
    setValue('');
    setAttachment(null);
    setShowMenu(false);
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
        {(councilMode || activeCanvasId || activeArtifactId || toolsState.webSearch) && (
          <div className="flex items-center gap-1.5 flex-wrap animate-fadeIn">
            {councilMode && (
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
            {toolsState.webSearch && (
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
          placeholder={placeholder}
          className="w-full bg-transparent border-0 text-[#191919] text-sm placeholder-[#85827D] resize-none focus:outline-none disabled:opacity-50"
          disabled={isLoading || disabled}
        />
        
        <div className="flex items-center justify-between mt-1 pt-1 relative border-t border-[#FBF9F6]">
          {/* Left Actions - Add attachment '+' icon with Popover Menu */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowMenu(!showMenu)}
              disabled={isLoading || disabled}
              className={`flex items-center justify-center p-1.5 rounded-full border text-[#85827D] hover:bg-[#F4F0EB] hover:text-[#191919] transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                showMenu ? 'bg-[#F4F0EB] text-[#191919] border-[#C2BCB2]' : 'border-[#E5E0DA]'
              }`}
              title="Attachment options & tools"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>

            <PopoverMenu
              isOpen={showMenu}
              onClose={() => setShowMenu(false)}
              councilMode={councilMode}
              setCouncilMode={setCouncilMode}
              toolsState={toolsState}
              setToolsState={setToolsState}
              projectId={projectId}
              onFileUploaded={onFileUploaded}
              councilConfig={councilConfig}
              setCouncilConfig={setCouncilConfig}
            />
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
                (!value.trim() && !attachment || isLoading || disabled)
                  ? 'bg-[#e6dfd8] text-[#8e8b82] cursor-not-allowed'
                  : 'bg-primary hover:bg-primary-active text-white hover:shadow-md hover:shadow-primary/10'
              }`}
            >
              <ArrowUp className="w-4 h-4" />
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
