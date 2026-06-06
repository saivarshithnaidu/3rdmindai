import React from 'react';
import { Play, Timer, BarChart3, Edit3, Gamepad2, Layers, Compass } from 'lucide-react';

interface Preset {
  title: string;
  description: string;
  prompt: string;
  type: 'app' | 'document' | 'chart' | 'tool' | 'game' | 'code';
  icon: React.ReactNode;
}

interface ArtifactPickerProps {
  onSelectPreset: (preset: Preset) => void;
}

export default function ArtifactPicker({ onSelectPreset }: ArtifactPickerProps) {
  const presets: Preset[] = [
    {
      title: 'Pomodoro Timer',
      description: 'Elegant custom focus timer with task list and custom themes.',
      prompt: 'Build a premium Pomodoro Timer app with standard, short break, and long break periods. Include a simple to-do list, customizable sound notifications, and a responsive theme toggler.',
      type: 'tool',
      icon: <Timer className="w-5 h-5 text-rose-500" />,
    },
    {
      title: 'SaaS Sales Dashboard',
      description: 'Stunning business dashboard using Chart.js graphs.',
      prompt: 'Create a beautiful SaaS sales performance dashboard with cards for MRR, Churn Rate, LTV, and CAC. Include a bar chart for monthly revenue growth and a line chart for customer signups using Chart.js via CDN.',
      type: 'chart',
      icon: <BarChart3 className="w-5 h-5 text-violet-500" />,
    },
    {
      title: 'Markdown Previewer',
      description: 'Rich text markdown editor with live HTML visual previews.',
      prompt: 'Generate an interactive Markdown Previewer app. Users can type markdown in a text area and see the fully parsed HTML output side-by-side. Include quick snippet buttons (bold, italic, header, link).',
      type: 'app',
      icon: <Edit3 className="w-5 h-5 text-emerald-500" />,
    },
    {
      title: 'Retro Snake Game',
      description: 'Classic arcade game with scores, highscores, and mobile controls.',
      prompt: 'Create a retro arcade Snake game inside a canvas. Support high score tracking, sound effects using synthesized audio, custom board size, and retro pixelated color themes.',
      type: 'game',
      icon: <Gamepad2 className="w-5 h-5 text-amber-500" />,
    },
    {
      title: 'CSS Palette Generator',
      description: 'Interactive color palette designer with copy-paste hex values.',
      prompt: 'Build a premium CSS Gradient & Palette generator. Allow selecting multiple colors, adjusting gradient angles, toggling linear vs radial gradients, and copy-to-clipboard buttons for HEX and CSS properties.',
      type: 'tool',
      icon: <Layers className="w-5 h-5 text-blue-500" />,
    },
    {
      title: 'SVG Designer & Exporter',
      description: 'Visual vector canvas editor showing code and export formats.',
      prompt: 'Create an interactive SVG shape painter. Provide controls to add circle, rectangle, and line elements, change fill and stroke colors, drag items to reposition, and export/copy the clean SVG code.',
      type: 'code',
      icon: <Compass className="w-5 h-5 text-indigo-500" />,
    },
  ];

  return (
    <div className="bg-[#FFFFFF] border border-[#E5E0DA] rounded-2xl p-5 shadow-xs font-dmsans max-w-xl mx-auto my-6 animate-fadeIn">
      <div className="flex items-center gap-2 mb-4">
        <div className="p-1.5 bg-neutral-900 rounded-lg text-white">
          <Play className="w-4 h-4" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-[#191919] font-lora">
            Interactive Artifact Presets
          </h3>
          <p className="text-[11px] text-[#85827D] font-medium mt-0.5">
            Select a preset below to instantly build a sandboxed web application.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {presets.map((preset, index) => (
          <button
            key={index}
            onClick={() => onSelectPreset(preset)}
            className="flex flex-col text-left p-3.5 border border-[#EBE5DC] bg-[#FAF9F6] hover:bg-[#FFFFFF] hover:border-[#191919] hover:shadow-sm rounded-xl cursor-pointer transition-all duration-200 group"
          >
            <div className="flex items-center justify-between w-full">
              <div className="p-1.5 bg-white border border-[#EBE5DC] rounded-lg group-hover:border-[#191919] transition-all">
                {preset.icon}
              </div>
              <span className="text-[9px] uppercase tracking-wider font-bold text-[#85827D] bg-[#EBE5DC]/60 group-hover:bg-[#191919] group-hover:text-white px-1.5 py-0.5 rounded-sm transition-all">
                {preset.type}
              </span>
            </div>
            <h4 className="text-xs font-bold text-[#191919] mt-3 group-hover:text-neutral-900 font-lora">
              {preset.title}
            </h4>
            <p className="text-[10px] text-[#5E5B56] leading-relaxed mt-1 font-medium">
              {preset.description}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}
