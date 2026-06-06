import React, { useState, useRef, useEffect } from 'react';
import { AVAILABLE_MODELS } from '../../lib/constants';
import { ChevronDown, Check } from 'lucide-react';

interface ModelSelectorProps {
  value: string;
  onChange: (val: string) => void;
  disabled?: boolean;
}

const getProviderColor = (provider: string) => {
  switch (provider.toLowerCase()) {
    case 'deepseek': return '#0070FF';
    case 'google': return '#4285F4';
    case 'openai': return '#10A37F';
    case 'mistral': return '#FD5A24';
    case 'moonshot': return '#FF007F';
    case 'meta': return '#0668E1';
    default: return '#6C47FF';
  }
};

const modelDetails: Record<string, { tag: string; desc: string }> = {
  'deepseek/deepseek-chat': { tag: 'Efficient & Smart', desc: 'Balanced high-reasoning speed' },
  'google/gemini-pro-1.5': { tag: 'Deep Analysis', desc: 'Huge context, great for research' },
  'openai/gpt-4o': { tag: 'Powerhouse Model', desc: 'Standard for complex logic & coding' },
  'mistralai/mistral-large': { tag: 'European Multilingual', desc: 'Strong reasoning & translation' },
  'moonshot/moonshot-v1-8k': { tag: 'Long Content', desc: 'Optimized long text processing' },
  'meta-llama/llama-3-70b-instruct': { tag: 'Ultra-Fast Inference', desc: 'High-speed open source intelligence' },
};

export default function ModelSelector({ value, onChange, disabled = false }: ModelSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedModelObj = AVAILABLE_MODELS.find(m => m.id === value);
  const dotColor = selectedModelObj ? getProviderColor(selectedModelObj.provider) : '#6C47FF';

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (modelId: string) => {
    onChange(modelId);
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className="relative font-dmsans">
      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 bg-[#F4F0EB] hover:bg-[#ECE5DD] border border-[#E5E0DA] rounded-lg px-2.5 py-1.5 transition-colors cursor-pointer text-xs font-semibold text-[#191919] select-none disabled:opacity-50 disabled:cursor-not-allowed shadow-2xs"
      >
        <span 
          className="w-2 h-2 rounded-full shrink-0" 
          style={{ 
            backgroundColor: dotColor, 
            boxShadow: `0 0 6px ${dotColor}` 
          }} 
        />
        <span>{selectedModelObj?.name || 'Select Model'}</span>
        <ChevronDown className={`w-3.5 h-3.5 text-[#85827D] transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Upward Dropdown Menu Card */}
      {isOpen && (
        <div className="absolute bottom-full right-0 mb-2 w-[280px] bg-[#FFFFFF] border border-[#E5E0DA] rounded-xl shadow-lg p-1.5 z-50 flex flex-col gap-1 transition-all animate-in fade-in slide-in-from-bottom-2 duration-150">
          <div className="px-2.5 py-1.5 border-b border-[#E5E0DA] mb-1">
            <span className="text-[10px] font-bold text-[#85827D] uppercase tracking-wider block">
              Orchestrator Pipeline Model
            </span>
          </div>
          <div className="flex flex-col gap-0.5 max-h-[320px] overflow-y-auto pr-0.5">
            {AVAILABLE_MODELS.map((model) => {
              const isSelected = model.id === value;
              const modelDotColor = getProviderColor(model.provider);
              const details = modelDetails[model.id] || { tag: 'General Purpose', desc: 'Standard model intelligence' };

              return (
                <button
                  key={model.id}
                  type="button"
                  onClick={() => handleSelect(model.id)}
                  className={`w-full text-left flex items-start gap-2.5 p-2 rounded-lg transition-all cursor-pointer ${
                    isSelected 
                      ? 'bg-[#F4F0EB] text-[#191919]' 
                      : 'hover:bg-[#F9F8F6] text-[#5E5B56] hover:text-[#191919]'
                  }`}
                >
                  <span 
                    className="w-2 h-2 rounded-full mt-1.5 shrink-0" 
                    style={{ 
                      backgroundColor: modelDotColor, 
                      boxShadow: `0 0 5px ${modelDotColor}` 
                    }} 
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs font-bold truncate">{model.name}</span>
                      <span className="text-[9px] font-bold text-[#85827D] uppercase shrink-0">{model.provider}</span>
                    </div>
                    <span className="text-[10px] text-[#85827D] font-semibold block mt-0.5">{details.tag}</span>
                    <span className="text-[9px] text-[#A5A19C] leading-snug block mt-0.5">{details.desc}</span>
                  </div>
                  {isSelected && (
                    <Check className="w-3.5 h-3.5 text-[#191919] mt-0.5 shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
