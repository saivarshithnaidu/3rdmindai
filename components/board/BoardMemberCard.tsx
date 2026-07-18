'use client';

import React from 'react';
import { StartupAgent } from '../../types';
import { Shield, Cpu, Sparkles, MessageSquare, Database } from 'lucide-react';

interface EnrichedAgent extends StartupAgent {
  memory_count?: number;
  latest_task?: {
    title: string;
    status: string;
    created_at: string;
  } | null;
}

interface BoardMemberCardProps {
  member: EnrichedAgent;
  onSelect?: (member: EnrichedAgent) => void;
}

const renderSparkline = (scores: (number | null)[] | undefined) => {
  if (!scores || scores.length === 0) return null;
  const validScores = scores.filter((s): s is number => s !== null);
  if (validScores.length < 2) return null;

  const isImproving = validScores[validScores.length - 1] >= validScores[0];
  const strokeColor = isImproving ? '#10B981' : '#F59E0B'; // green vs amber
  
  const width = 35;
  const height = 12;
  const maxVal = Math.max(...validScores, 50);
  const minVal = 0;
  const range = maxVal - minVal || 1;
  
  const points = validScores.map((val, idx) => {
    const x = (idx / (validScores.length - 1)) * width;
    const y = height - ((val - minVal) / range) * height;
    return `${x},${y}`;
  }).join(' ');

  return (
    <div className="flex items-center shrink-0" title={`Recent task score trend: ${validScores.join(', ')}`}>
      <svg width={width} height={height} className="overflow-visible">
        <polyline
          fill="none"
          stroke={strokeColor}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={points}
        />
        <circle 
          cx={width} 
          cy={height - ((validScores[validScores.length - 1] - minVal) / range) * height} 
          r="1.5" 
          fill={strokeColor} 
        />
      </svg>
    </div>
  );
};

export default function BoardMemberCard({ member, onSelect }: BoardMemberCardProps) {
  // Map roles to friendly board titles and icons
  const roleInfo: Record<string, { title: string; desc: string; color: string; badge: string }> = {
    ceo: { 
      title: 'Chairman of the Board & CEO', 
      desc: 'Sets corporate strategy, goals, and alignment.', 
      color: 'from-[#cc785c]/10 to-[#cc785c]/20 text-[#cc785c]',
      badge: 'bg-[#cc785c]/10 text-[#cc785c] border-[#cc785c]/20'
    },
    cto: { 
      title: 'Technical Director & CTO', 
      desc: 'Oversees product execution, tech stack, and architectures.',
      color: 'from-[#5db8a6]/10 to-[#5db8a6]/20 text-[#5db8a6]',
      badge: 'bg-[#5db8a6]/10 text-[#5db8a6] border-[#5db8a6]/20'
    },
    cmo: { 
      title: 'Marketing & Brand Director', 
      desc: 'Drives user acquisition, brand positioning, and campaigns.',
      color: 'from-[#e8a55a]/10 to-[#e8a55a]/20 text-[#e8a55a]',
      badge: 'bg-[#e8a55a]/10 text-[#e8a55a] border-[#e8a55a]/20'
    },
    cfo: { 
      title: 'Finance & Compliance Director', 
      desc: 'Controls budget allocation, run-rate, and legal filings.',
      color: 'from-[#5db872]/10 to-[#5db872]/20 text-[#5db872]',
      badge: 'bg-[#5db872]/10 text-[#5db872] border-[#5db872]/20'
    },
    cso: { 
      title: 'Strategy & Alliances Director', 
      desc: 'Leads market placement, fundraising, and partner contracts.',
      color: 'from-[#d4a017]/10 to-[#d4a017]/20 text-[#d4a017]',
      badge: 'bg-[#d4a017]/10 text-[#d4a017] border-[#d4a017]/20'
    },
    cro: { 
      title: 'Growth & Outreach Director', 
      desc: 'Coordinates lead generation pipelines and sales communications.',
      color: 'from-[#c64545]/10 to-[#c64545]/20 text-[#c64545]',
      badge: 'bg-[#c64545]/10 text-[#c64545] border-[#c64545]/20'
    }
  };

  const info = roleInfo[member.role.toLowerCase()] || {
    title: 'Director',
    desc: 'Advises on corporate growth and strategic metrics.',
    color: 'from-muted/10 to-muted/20 text-muted',
    badge: 'bg-muted/10 text-muted border-muted/20'
  };

  // Extract initials for the serif display badge
  const initials = member.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

  return (
    <div 
      onClick={() => onSelect?.(member)}
      className="group relative bg-[#FFFFFF] border border-[#E5E0DA] hover:border-[#cc785c] rounded-2xl p-5 transition-all duration-300 shadow-2xs hover:shadow-xs flex flex-col justify-between cursor-pointer select-none text-left"
    >
      <div>
        {/* Card Header Profile Row */}
        <div className="flex items-start justify-between gap-4">
          <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${info.color} flex items-center justify-center font-lora text-xl font-medium tracking-tight shadow-3xs`}>
            {initials}
          </div>
          
          {/* Active status indicator */}
          <div className="flex items-center gap-1.5 bg-surface-soft border border-hairline px-2 py-0.5 rounded-full">
            <span className={`w-1.5 h-1.5 rounded-full ${member.is_active ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
            <span className="text-[9px] font-bold text-muted uppercase tracking-wider">
              {member.is_active ? 'Active' : 'Offline'}
            </span>
          </div>
        </div>

        {/* Member Names and Roles */}
        <div className="mt-4">
          <h3 className="font-serif text-lg font-normal text-ink leading-tight group-hover:text-[#cc785c] transition-colors">
            {member.name}
          </h3>
          <p className="text-xs font-semibold text-muted mt-0.5 tracking-tight">
            {info.title}
          </p>
          <p className="text-xs text-muted-soft mt-2 leading-relaxed">
            {info.desc}
          </p>
        </div>
      </div>

      {/* Meta Stats and Details */}
      <div className="mt-5 pt-4 border-t border-hairline space-y-3">
        {/* Model Identifier */}
        <div className="flex items-center justify-between text-[10px] text-muted">
          <span className="flex items-center gap-1">
            <Cpu className="w-3.5 h-3.5 text-muted-soft" />
            <span>AI Brain:</span>
          </span>
          <span className="font-mono bg-surface-soft px-1.5 py-0.5 rounded text-body max-w-[120px] truncate">
            {member.model.split('/').pop()}
          </span>
        </div>

        {/* Learning Version and Trend */}
        {(member.strategy_version !== undefined || member.strategyVersion !== undefined) && (
          <div className="flex items-center justify-between text-[10px] text-muted">
            <span className="flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-[#cc785c]" />
              <span>Learning:</span>
            </span>
            <div className="flex items-center gap-2">
              {renderSparkline(member.last_5_scores || member.last5Scores)}
              <span className="font-bold text-[#cc785c] bg-[#cc785c]/10 px-1.5 py-0.5 rounded border border-[#cc785c]/20 text-[9px] uppercase tracking-wider">
                v{member.strategy_version || member.strategyVersion || 1}
              </span>
            </div>
          </div>
        )}

        {/* Memory Count */}
        <div className="flex items-center justify-between text-[10px] text-muted">
          <span className="flex items-center gap-1">
            <Database className="w-3.5 h-3.5 text-muted-soft" />
            <span>Memory Units:</span>
          </span>
          <span className="font-bold text-ink">
            {member.memory_count ?? 0} facts
          </span>
        </div>

        {/* Latest task indicator */}
        {member.latest_task ? (
          <div className="bg-surface-soft/60 border border-hairline/50 rounded-lg p-2 mt-1">
            <div className="text-[9px] font-extrabold uppercase tracking-wider text-muted flex justify-between items-center">
              <span>Current Briefing</span>
              <span className={`text-[8px] px-1 py-0.2 rounded-full ${
                member.latest_task.status === 'done' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-blue-50 text-blue-700 border border-blue-200'
              }`}>
                {member.latest_task.status}
              </span>
            </div>
            <div className="text-[10px] text-ink font-semibold truncate mt-1">
              {member.latest_task.title}
            </div>
          </div>
        ) : (
          <div className="text-[10px] italic text-muted-soft text-center py-1 bg-surface-soft/30 rounded-lg">
            No active assignments.
          </div>
        )}
      </div>
    </div>
  );
}
