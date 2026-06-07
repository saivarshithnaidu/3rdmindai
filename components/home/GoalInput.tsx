'use client';

import React, { useState } from 'react';
import { DEFAULT_ORCHESTRATOR_MODEL, AVAILABLE_MODELS } from '../../lib/constants';
import { ArrowUp, Plus, Loader2, FileText, X, Brain, Database } from 'lucide-react';
import { motion } from 'framer-motion';
import ModelSelector from '../workspace/ModelSelector';

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
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

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
      
      setUploadedResume(parseData.text);
      setUploadedFilename(file.name);
      
      alert(`File parsed successfully: ${file.name}`);
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

        {showMenu && (
          <div className="border-t border-[#F4F0EB] pt-4 mt-2 grid grid-cols-1 md:grid-cols-2 gap-4 animate-fadeIn">
            {/* Left Column: Context & Connectors */}
            <div className="space-y-4">
              {/* Context File */}
              <div className="bg-[#FBF9F6] border border-[#E5E0DA] rounded-xl p-3 space-y-2">
                <span className="text-[10px] font-bold text-[#85827D] uppercase tracking-wider block">1. File Context</span>
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
                  className="w-full flex items-center justify-center gap-2 py-2 border border-dashed border-[#C2BCB2] hover:bg-[#F4F0EB] text-xs font-semibold text-[#5E5B56] rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-[#85827D]" />
                      <span>Parsing context file...</span>
                    </>
                  ) : (
                    <>
                      <Plus className="w-3.5 h-3.5" />
                      <span>Attach PDF, TXT, or MD</span>
                    </>
                  )}
                </button>
              </div>

              {/* Connectors & Tools */}
              <div className="bg-[#FBF9F6] border border-[#E5E0DA] rounded-xl p-3 space-y-2">
                <span className="text-[10px] font-bold text-[#85827D] uppercase tracking-wider block">2. Connectors & Tools</span>
                <div className="space-y-1">
                  {(Object.keys(toolsState) as Array<keyof typeof toolsState>).map((key) => {
                    const labels: Record<string, string> = {
                      webSearch: 'Tavily Web Search',
                      exaSearch: 'Exa Neural Search',
                      kaggle: 'Kaggle Datasets',
                      database: 'Supabase PostgreSQL',
                      rag: 'Qdrant Vector RAG'
                    };
                    return (
                      <div key={key} className="flex items-center justify-between py-1 text-xs font-semibold text-[#5E5B56]">
                        <span>{labels[key]}</span>
                        <button
                          type="button"
                          onClick={() => setToolsState(prev => ({ ...prev, [key]: !prev[key] }))}
                          className={`w-7 h-4 rounded-full p-0.5 transition-colors duration-250 cursor-pointer ${
                            toolsState[key] ? 'bg-emerald-600' : 'bg-[#E5E0DA]'
                          }`}
                        >
                          <div className={`w-3 h-3 rounded-full bg-white transition-transform duration-200 ${
                            toolsState[key] ? 'translate-x-3' : 'translate-x-0'
                          }`} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Right Column: AI Council */}
            <div className="space-y-4">
              <div className="bg-[#FBF9F6] border border-[#E5E0DA] rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between pb-1 border-b border-[#F4F0EB]">
                  <div className="flex items-center gap-1.5">
                    <Brain className={`w-4 h-4 ${councilMode ? 'text-purple-600' : 'text-[#85827D]'}`} />
                    <span className="text-[10px] font-bold text-[#85827D] uppercase tracking-wider">3. AI Council Mode</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCouncilMode(!councilMode)}
                    className={`w-7 h-4 rounded-full p-0.5 transition-colors duration-250 cursor-pointer ${
                      councilMode ? 'bg-[#5B39E0]' : 'bg-[#E5E0DA]'
                    }`}
                  >
                    <div className={`w-3 h-3 rounded-full bg-white transition-transform duration-200 ${
                      councilMode ? 'translate-x-3' : 'translate-x-0'
                    }`} />
                  </button>
                </div>

                {councilMode && (
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-bold text-[#85827D] uppercase">Seats ({councilConfig.seats.length})</span>
                      <label className="flex items-center gap-1 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={councilConfig.enableVerdict}
                          onChange={(e) => setCouncilConfig(prev => ({ ...prev, enableVerdict: e.target.checked }))}
                          className="rounded text-purple-600 focus:ring-purple-500 w-3 h-3"
                        />
                        <span className="text-[9px] text-[#5E5B56] font-semibold">Arbiter Verdict</span>
                      </label>
                    </div>

                    <div className="space-y-1.5">
                      {councilConfig.seats.map((seat, index) => (
                        <div key={index} className="flex items-center gap-1.5 bg-white p-1.5 border border-[#EBE5DC] rounded-lg shadow-3xs">
                          <input
                            type="text"
                            value={seat.name}
                            onChange={(e) => {
                              const newSeats = [...councilConfig.seats];
                              newSeats[index] = { ...newSeats[index], name: e.target.value, role: `${e.target.value} Seat` };
                              setCouncilConfig(prev => ({ ...prev, seats: newSeats }));
                            }}
                            className="w-16 text-[10px] bg-transparent border-0 border-b border-[#E5E0DA] focus:border-purple-500 px-0.5 py-0.5 font-bold text-[#191919] focus:outline-none"
                            placeholder="Seat name"
                          />
                          <select
                            value={seat.model}
                            onChange={(e) => {
                              const newSeats = [...councilConfig.seats];
                              newSeats[index] = { ...newSeats[index], model: e.target.value };
                              setCouncilConfig(prev => ({ ...prev, seats: newSeats }));
                            }}
                            className="flex-grow text-[9px] bg-transparent border border-[#E5E0DA] rounded px-1 py-0.5 font-medium text-[#5E5B56] focus:outline-none max-w-[110px] truncate"
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
                                setCouncilConfig(prev => ({ ...prev, seats: newSeats }));
                              }}
                              className="p-0.5 text-red-500 hover:bg-red-50 rounded text-xs transition-colors"
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
                          setCouncilConfig(prev => ({ ...prev, seats: [...prev.seats, newSeat] }));
                        }}
                        className="w-full text-center py-1 border border-dashed border-[#C2BCB2] hover:bg-[#F4F0EB] text-[9px] font-bold text-[#5E5B56] rounded transition-colors cursor-pointer"
                      >
                        + Add Seat
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between mt-1 pt-2 border-t border-[#F4F0EB] relative">
          {/* Left Actions - Add attachment '+' icon to open settings panel inline */}
          <div>
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
