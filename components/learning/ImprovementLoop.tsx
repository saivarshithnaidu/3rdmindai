'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Activity, Sparkles, RefreshCw } from 'lucide-react';

interface ImprovementLoopProps {
  totalLearnings: number;
  strategyVersion: number;
  lastExtractionDate?: string | null;
}

export default function ImprovementLoop({
  totalLearnings,
  strategyVersion,
  lastExtractionDate
}: ImprovementLoopProps) {
  // Calculate Sunday trigger dates
  const now = new Date();
  
  // Last Sunday 10am UTC
  const lastSunday = new Date();
  lastSunday.setUTCDate(now.getUTCDate() - now.getUTCDay());
  lastSunday.setUTCHours(10, 0, 0, 0);
  if (lastSunday > now) {
    lastSunday.setUTCDate(lastSunday.getUTCDate() - 7);
  }

  // Next Sunday 10am UTC
  const nextSunday = new Date(lastSunday);
  nextSunday.setUTCDate(lastSunday.getUTCDate() + 7);

  const formatDate = (date: Date) => {
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const displayLastExtraction = lastExtractionDate ? formatDate(new Date(lastExtractionDate)) : formatDate(lastSunday);
  const displayNextExtraction = formatDate(nextSunday);

  // SVG parameters
  const size = 180;
  const center = size / 2;
  const radius = 65;

  // 6 nodes on the circle
  const nodes = [
    { label: 'Task Runs', angle: 0, color: '#3B82F6' },
    { label: 'Judge Scores', angle: 60, color: '#8B5CF6' },
    { label: 'Outcome Traced', angle: 120, color: '#10B981' },
    { label: 'User Feedback', angle: 180, color: '#F59E0B' },
    { label: 'Insights Extracted', angle: 240, color: '#EC4899' },
    { label: 'Strategy Updated', angle: 300, color: '#D97757' }
  ];

  return (
    <div className="bg-white border border-[#E5E0DA] rounded-3xl p-6 flex flex-col items-center gap-5 shadow-[0_4px_20px_rgba(25,25,25,0.01)] text-center font-dmsans select-none">
      <div className="space-y-1 w-full">
        <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-[#85827D]">
          <span className="flex items-center gap-1.5"><Activity className="w-3.5 h-3.5 text-emerald-600 animate-pulse" /> Self-Improving Loop</span>
          <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-100 px-2 py-0.5 rounded-full font-bold uppercase">Active</span>
        </div>
      </div>

      {/* SVG Circular Loop Diagram */}
      <div className="relative w-[180px] h-[180px]">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="overflow-visible">
          {/* Outer circle track */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="#F5F3EE"
            strokeWidth="3"
            strokeDasharray="6 4"
          />

          {/* Animated flow path */}
          <motion.circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="url(#loopGradient)"
            strokeWidth="3.5"
            strokeLinecap="round"
            initial={{ strokeDasharray: "40 200", strokeDashoffset: 0 }}
            animate={{ strokeDashoffset: -240 }}
            transition={{ repeat: Infinity, duration: 8, ease: "linear" }}
          />

          <defs>
            <linearGradient id="loopGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#D97757" />
              <stop offset="50%" stopColor="#8B5CF6" />
              <stop offset="100%" stopColor="#3B82F6" />
            </linearGradient>
          </defs>

          {/* Connection lines from center */}
          {nodes.map((node, idx) => {
            const rad = (node.angle * Math.PI) / 180;
            const x = center + radius * Math.cos(rad);
            const y = center + radius * Math.sin(rad);

            return (
              <g key={idx}>
                {/* Node connection line */}
                <line
                  x1={center}
                  y1={center}
                  x2={x}
                  y2={y}
                  stroke="#F5F3EE"
                  strokeWidth="1"
                />

                {/* Node dot */}
                <motion.circle
                  cx={x}
                  cy={y}
                  r="5"
                  fill={node.color}
                  stroke="#ffffff"
                  strokeWidth="1.5"
                  whileHover={{ r: 7 }}
                  className="cursor-pointer"
                />
              </g>
            );
          })}

          {/* Center Brain Core */}
          <g className="cursor-pointer">
            <circle cx={center} cy={center} r="24" fill="#191919" stroke="#E5E0DA" strokeWidth="2" />
            <Sparkles className="w-5 h-5 text-[#D97757] absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
          </g>
        </svg>

        {/* Floating Node Labels */}
        {nodes.map((node, idx) => {
          const rad = (node.angle * Math.PI) / 180;
          // Offset label position slightly outwards
          const x = center + (radius + 20) * Math.cos(rad);
          const y = center + (radius + 14) * Math.sin(rad);

          return (
            <div
              key={idx}
              style={{
                position: 'absolute',
                left: `${x}px`,
                top: `${y}px`,
                transform: 'translate(-50%, -50%)',
                whiteSpace: 'nowrap'
              }}
              className="text-[7.5px] font-black uppercase tracking-wider text-[#85827D] bg-white px-1 py-0.5 rounded border border-[#E5E0DA] shadow-3xs"
            >
              {node.label}
            </div>
          );
        })}
      </div>

      {/* Loop Metadata Stats */}
      <div className="w-full grid grid-cols-2 gap-4 border-t border-[#F5F3EE] pt-4 text-left">
        <div className="space-y-0.5">
          <span className="text-[8px] font-bold text-[#85827D] uppercase tracking-wider block">Last Extraction</span>
          <span className="text-[10px] font-bold text-[#191919] block">{displayLastExtraction}</span>
        </div>
        <div className="space-y-0.5">
          <span className="text-[8px] font-bold text-[#85827D] uppercase tracking-wider block">Next Extraction</span>
          <span className="text-[10px] font-bold text-[#191919] block">{displayNextExtraction}</span>
        </div>
        <div className="space-y-0.5">
          <span className="text-[8px] font-bold text-[#85827D] uppercase tracking-wider block">Total Learnings</span>
          <span className="text-[10px] font-bold text-[#191919] block">{totalLearnings} insights</span>
        </div>
        <div className="space-y-0.5">
          <span className="text-[8px] font-bold text-[#85827D] uppercase tracking-wider block">Strategy Version</span>
          <span className="text-[10px] font-bold text-[#D97757] block flex items-center gap-1">
            <RefreshCw className="w-3 h-3 text-[#D97757]" /> v{strategyVersion}
          </span>
        </div>
      </div>
    </div>
  );
}
