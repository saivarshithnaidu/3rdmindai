'use client';

import React from 'react';
import { PenTool, GraduationCap, Code, Coffee, Lightbulb } from 'lucide-react';

interface QuickChipsProps {
  onChipClick: (text: string) => void;
}

const CHIPS = [
  { 
    label: 'Write', 
    text: 'Draft a premium email newsletter announcing a new design framework.',
    icon: <PenTool className="w-3.5 h-3.5 text-[#85827D]" />
  },
  { 
    label: 'Learn', 
    text: 'Explain the key mathematical concepts behind diffusion models in machine learning.',
    icon: <GraduationCap className="w-3.5 h-3.5 text-[#85827D]" />
  },
  { 
    label: 'Code', 
    text: 'Implement a responsive Next.js grid layout using CSS grid and Framer Motion.',
    icon: <Code className="w-3.5 h-3.5 text-[#85827D]" />
  },
  { 
    label: 'Life stuff', 
    text: 'Plan a healthy 7-day meal plan with high-protein vegetarian recipes.',
    icon: <Coffee className="w-3.5 h-3.5 text-[#85827D]" />
  },
  { 
    label: "3RDMIND's choice", 
    text: 'Create a detailed product specification for a voice-controlled home assistant.',
    icon: <Lightbulb className="w-3.5 h-3.5 text-[#85827D]" />
  },
];

export default function QuickChips({ onChipClick }: QuickChipsProps) {
  return (
    <div className="flex flex-wrap gap-2 justify-center font-dmsans">
      {CHIPS.map((chip) => (
        <button
          key={chip.label}
          type="button"
          onClick={() => onChipClick(chip.text)}
          className="flex items-center gap-1.5 text-xs bg-transparent text-[#5E5B56] border border-[#E5E0DA] hover:bg-[#F4F0EB] hover:text-[#191919] rounded-lg px-3 py-1.5 transition-all cursor-pointer shadow-2xs"
        >
          {chip.icon}
          <span>{chip.label}</span>
        </button>
      ))}
    </div>
  );
}
