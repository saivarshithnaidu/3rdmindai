'use client';

import React, { useState } from 'react';
import { DEFAULT_ORCHESTRATOR_MODEL } from '../../lib/constants';
import { ArrowUp, Plus, Loader2, FileText, X } from 'lucide-react';
import { motion } from 'framer-motion';
import ModelSelector from '../workspace/ModelSelector';
import PopoverMenu from '../workspace/PopoverMenu';

interface GoalInputProps {
  value: string;
  onChange: (val: string) => void;
  onSubmit: (goal: string, model: string, options?: any) => void;
  isLoading: boolean;
}

export default function GoalInput({ value, onChange, onSubmit, isLoading }: GoalInputProps) {
  const [selectedModel, setSelectedModel] = useState(DEFAULT_ORCHESTRATOR_MODEL);
  const [showMenu, setShowMenu] = useState(false);
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

  const [uploadedResume, setUploadedResume] = useState<string | null>(null);
  const [uploadedFilename, setUploadedFilename] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if ((!value.trim() && !uploadedResume) || isLoading) return;
    
    let finalValue = value;
    if (uploadedResume && !value.trim()) {
      finalValue = `Process and analyze the attached context document: ${uploadedFilename}`;
    }

    onSubmit(finalValue, selectedModel, {
      councilMode,
      councilConfig,
      ...toolsState,
      masterResume: uploadedResume,
      filename: uploadedFilename
    });
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
      setUploadedResume(text);
      setUploadedFilename(filename);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-4xl mx-auto mt-6 font-dmsans">
      <div className="relative bg-[#FFFFFF] border border-[#E5E0DA] rounded-2xl p-4 transition-all duration-300 focus-within:border-[#B5AFA5] focus-within:shadow-[0_12px_40px_rgba(25,25,25,0.05)] shadow-[0_1px_3px_rgba(0,0,0,0.01)] flex flex-col gap-2">
        <textarea
          rows={2}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder="Give 3RDMIND a goal..."
          className="w-full bg-transparent border-0 text-[#191919] text-sm placeholder-[#85827D] resize-none focus:outline-none leading-relaxed"
          disabled={isLoading}
        />
        
        {uploadedFilename && (
          <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-100 text-emerald-700 px-3 py-1 rounded-xl text-xs w-fit select-none animate-fadeIn">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span>Attached Context: <strong>{uploadedFilename}</strong></span>
            {uploadedResume && (
              <span className="text-[10px] text-emerald-800 opacity-80 font-mono font-normal">({(uploadedResume.length / 1024).toFixed(1)} KB)</span>
            )}
            <button
              type="button"
              onClick={() => {
                setUploadedResume(null);
                setUploadedFilename(null);
              }}
              className="ml-1 p-0.5 hover:bg-emerald-100 rounded text-emerald-800 transition-colors cursor-pointer"
              title="Remove context"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        <div className="flex items-center justify-between mt-1 pt-2 border-t border-[#F4F0EB] relative">
          {/* Left Actions - Add attachment '+' icon with Popover */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowMenu(!showMenu)}
              disabled={isLoading}
              className={`flex items-center justify-center p-1.5 rounded-xl border text-[#85827D] hover:bg-[#F4F0EB] hover:text-[#191919] transition-all duration-200 cursor-pointer hover:border-[#C2BCB2] ${
                showMenu ? 'bg-[#F4F0EB] text-[#191919] border-[#C2BCB2]' : 'border-[#E5E0DA]'
              }`}
              title="Attachment options & tools"
            >
              <Plus className="w-4 h-4" />
            </button>

            <PopoverMenu
              isOpen={showMenu}
              onClose={() => setShowMenu(false)}
              councilMode={councilMode}
              setCouncilMode={setCouncilMode}
              toolsState={toolsState}
              setToolsState={setToolsState}
              onFileUploaded={(text, filename) => {
                setUploadedResume(text);
                setUploadedFilename(filename);
              }}
              councilConfig={councilConfig}
              setCouncilConfig={setCouncilConfig}
            />
          </div>

          {/* Right Actions - Model Selector + Submit Button */}
          <div className="flex items-center gap-3">
            {/* Model Selector Dropdown */}
            <ModelSelector
              value={selectedModel}
              onChange={setSelectedModel}
              disabled={isLoading}
            />

            {/* Submit Button */}
            <motion.button
              type="submit"
              disabled={(!value.trim() && !uploadedResume) || isLoading}
              animate={(value.trim() || uploadedResume) && !isLoading ? { scale: [1, 1.03, 1] } : { scale: 1 }}
              transition={(value.trim() || uploadedResume) && !isLoading ? { repeat: Infinity, duration: 2, ease: 'easeInOut' } : {}}
              className={`flex items-center justify-center rounded-full p-2.5 text-white transition-all duration-200 cursor-pointer ${
                (!value.trim() && !uploadedResume || isLoading)
                  ? 'bg-[#e6dfd8] text-[#8e8b82] cursor-not-allowed'
                  : 'bg-primary hover:bg-primary-active hover:shadow-md hover:shadow-primary/10'
              }`}
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin text-white" />
              ) : (
                <ArrowUp className="w-4 h-4" />
              )}
            </motion.button>
          </div>
        </div>
      </div>
    </form>
  );
}
