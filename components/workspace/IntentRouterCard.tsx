'use client';

import React from 'react';
import NeuralSymbol from './NeuralSymbol';

interface IntentRouterCardProps {
  intent: string;
  complexity: string;
  route: string;
  councilRequired: boolean;
}

export default function IntentRouterCard({
  intent,
  complexity,
  route,
  councilRequired
}: IntentRouterCardProps) {
  const complexityLower = (complexity || '').toLowerCase();
  
  let complexityColor = 'text-emerald-700 bg-emerald-50 border-emerald-100';
  if (complexityLower === 'high') {
    complexityColor = 'text-rose-700 bg-rose-50 border-rose-100';
  } else if (complexityLower === 'medium') {
    complexityColor = 'text-amber-700 bg-amber-50 border-amber-100';
  }

  return (
    <div className="w-full max-w-4xl mx-auto my-3 font-dmsans select-none animate-fadeIn">
      <div className="border border-[#E5E0DA] bg-[#FFFFFF] rounded-xl p-4 shadow-2xs">
        <div className="flex items-center gap-2 border-b border-[#F4F0EB] pb-2 mb-3">
          <NeuralSymbol state="thinking" size={14} className="shrink-0" />
          <span className="text-[10px] font-bold text-[#cc785c] tracking-wider uppercase font-mono">
            3RDMIND Intent Router Classification
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
          <div className="flex flex-col">
            <span className="text-[9px] text-[#8e8b82] uppercase tracking-wider font-mono">Intent</span>
            <span className="font-lora font-bold text-[#141413] mt-0.5 text-sm">{intent || 'Unknown'}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[9px] text-[#8e8b82] uppercase tracking-wider font-mono">Complexity</span>
            <span className={`font-mono font-bold mt-0.5 text-[11px] border px-1.5 py-0.5 rounded w-max leading-none ${complexityColor}`}>
              {complexity || 'Low'}
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-[9px] text-[#8e8b82] uppercase tracking-wider font-mono">Route</span>
            <span className="font-lora font-bold text-[#7B61FF] mt-0.5 text-sm">{route || 'Direct Conversation'}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[9px] text-[#8e8b82] uppercase tracking-wider font-mono">Council Required</span>
            <span className="font-mono font-bold text-[#141413] mt-0.5 text-sm">{councilRequired ? 'Yes' : 'No'}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
