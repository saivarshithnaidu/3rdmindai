'use client';

import React from 'react';
import { Search, Code, TrendingUp, Globe, Database, Workflow } from 'lucide-react';

interface QuickChipsProps {
  onChipClick: (text: string) => void;
}

const CHIPS = [
  { 
    label: 'Build a SaaS', 
    text: 'Design and outline a B2B SaaS CRM system for law firms, detailing database models and user workflow.',
    icon: <Code className="w-3.5 h-3.5 text-[#85827D]" />
  },
  { 
    label: 'Analyze a Market', 
    text: 'Analyze the market and customer segments for premium sustainable running shoes in metropolitan cities.',
    icon: <TrendingUp className="w-3.5 h-3.5 text-[#85827D]" />
  },
  { 
    label: 'GTM Strategy', 
    text: 'Create a Go-To-Market launch strategy and distribution channels for an AI-powered email writing copilot.',
    icon: <Globe className="w-3.5 h-3.5 text-[#85827D]" />
  },
  { 
    label: 'Research Competitors', 
    text: 'Research key competitors in the modern calendar scheduling space, comparing features and pricing tiers.',
    icon: <Search className="w-3.5 h-3.5 text-[#85827D]" />
  },
  { 
    label: 'Design a System', 
    text: 'Design a real-time multiplayer collaborative document system architecture with WebSocket event handling.',
    icon: <Database className="w-3.5 h-3.5 text-[#85827D]" />
  },
  { 
    label: 'AI Workflow', 
    text: 'Create an autonomous multi-agent workflow that polls database tasks, executes verification, and reports metrics.',
    icon: <Workflow className="w-3.5 h-3.5 text-[#85827D]" />
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

