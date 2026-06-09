'use client';

import React from 'react';
import { Mic, Check } from 'lucide-react';

interface VoiceOption {
  id: string;
  name: string;
  description: string;
  accent: string;
}

const VOICE_OPTIONS: VoiceOption[] = [
  { id: 'rachel', name: 'Rachel', description: 'Warm & professional', accent: 'American female' },
  { id: 'josh', name: 'Josh', description: 'Clear & authoritative', accent: 'American male' },
  { id: 'elli', name: 'Elli', description: 'Polished & articulate', accent: 'British female' },
  { id: 'adam', name: 'Adam', description: 'Deep & composed', accent: 'British male' },
  { id: 'domi', name: 'Domi', description: 'Vibrant & energetic', accent: 'Energetic female' },
  { id: 'dave', name: 'Dave', description: 'Relaxed & friendly', accent: 'Casual male' },
];

interface VoiceSelectorProps {
  selectedVoice: string;
  onSelect: (voiceId: string) => void;
}

export default function VoiceSelector({ selectedVoice, onSelect }: VoiceSelectorProps) {
  return (
    <div className="space-y-3">
      <label className="text-[10px] font-bold text-muted uppercase tracking-wider block">
        Narrator Voice
      </label>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {VOICE_OPTIONS.map((voice) => {
          const isSelected = selectedVoice === voice.id;
          return (
            <button
              key={voice.id}
              type="button"
              onClick={() => onSelect(voice.id)}
              className={`relative flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all cursor-pointer text-center ${
                isSelected
                  ? 'border-[#cc785c] bg-[#cc785c]/5 shadow-sm'
                  : 'border-[#E5E0DA] bg-white hover:border-[#cc785c]/40 hover:bg-surface-soft/30'
              }`}
            >
              {isSelected && (
                <div className="absolute top-2 right-2">
                  <Check className="w-3.5 h-3.5 text-[#cc785c]" />
                </div>
              )}
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  isSelected ? 'bg-[#cc785c]/15' : 'bg-surface-soft'
                }`}
              >
                <Mic className={`w-4.5 h-4.5 ${isSelected ? 'text-[#cc785c]' : 'text-muted-soft'}`} />
              </div>
              <div>
                <div className={`text-xs font-bold ${isSelected ? 'text-ink' : 'text-ink'}`}>
                  {voice.name}
                </div>
                <div className="text-[9px] text-muted-soft mt-0.5">{voice.accent}</div>
                <div className="text-[9px] text-muted mt-0.5 italic">{voice.description}</div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
