'use client';

import React from 'react';

interface NeuralSymbolProps {
  state?: 'thinking' | 'execution' | 'idle' | 'completed' | 'failed';
  size?: number;
  className?: string;
}

export default function NeuralSymbol({
  state = 'idle',
  size = 24,
  className = '',
}: NeuralSymbolProps) {
  // Premium HSL design palette colors
  const gold = '#E59A5A';
  const purple = '#7B61FF';
  const border = '#E9E2D9';
  
  let primaryColor = gold;
  let secondaryColor = border;
  
  if (state === 'thinking') {
    primaryColor = gold;
    secondaryColor = 'rgba(229, 154, 90, 0.25)';
  } else if (state === 'execution') {
    primaryColor = purple;
    secondaryColor = 'rgba(123, 97, 255, 0.25)';
  } else if (state === 'completed') {
    primaryColor = '#5db872'; // Success green
    secondaryColor = 'rgba(93, 184, 114, 0.2)';
  } else if (state === 'failed') {
    primaryColor = '#c64545'; // Error red
    secondaryColor = 'rgba(198, 69, 69, 0.2)';
  } else {
    // idle
    primaryColor = '#8e8b82'; // muted soft
    secondaryColor = '#e6dfd8';
  }

  // Pure SVG/CSS animations for premium micro-interactions and smooth performance
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={`inline-block select-none ${className}`}
      style={{ overflow: 'visible' }}
    >
      <style>{`
        @keyframes orbit-rotate-symbol {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes pulse-glow-symbol {
          0%, 100% { opacity: 0.4; transform: scale(0.96); }
          50% { opacity: 1.0; transform: scale(1.04); }
        }
        @keyframes dash-symbol {
          to { stroke-dashoffset: -40; }
        }
        .symbol-orbit {
          transform-origin: center;
          animation: orbit-rotate-symbol ${state === 'thinking' ? '14s' : state === 'execution' ? '8s' : '0s'} linear infinite;
        }
        .symbol-inner {
          transform-origin: center;
          animation: pulse-glow-symbol 2.5s ease-in-out infinite;
        }
        .symbol-dash {
          stroke-dasharray: 8 4;
          animation: dash-symbol 4s linear infinite;
        }
      `}</style>
      
      {/* Outer Glow Halo */}
      {(state === 'thinking' || state === 'execution') && (
        <circle
          cx="50"
          cy="50"
          r="48"
          fill="none"
          stroke={primaryColor}
          strokeWidth="1"
          opacity="0.15"
          style={{ transformOrigin: 'center', animation: 'pulse-glow-symbol 1.8s ease-in-out infinite' }}
        />
      )}

      {/* Outer Ring */}
      <circle
        cx="50"
        cy="50"
        r="40"
        fill="none"
        stroke={secondaryColor}
        strokeWidth="1.5"
      />

      {/* Orbital paths and nodes */}
      <g className="symbol-orbit">
        {/* Orbital Track */}
        <circle
          cx="50"
          cy="50"
          r="28"
          fill="none"
          stroke={primaryColor}
          strokeWidth="1"
          opacity={state === 'idle' ? '0.1' : '0.25'}
          className={state === 'thinking' || state === 'execution' ? 'symbol-dash' : ''}
        />
        
        {/* Outer orbital nodes */}
        <circle cx="50" cy="10" r="4" fill={primaryColor} />
        <circle cx="50" cy="90" r="4" fill={primaryColor} />
        <circle cx="10" cy="50" r="4" fill={primaryColor} />
        <circle cx="90" cy="50" r="4" fill={primaryColor} />
      </g>

      {/* Inner Central Mind Node Network */}
      <g className="symbol-inner">
        {/* Connections */}
        <line x1="50" y1="50" x2="35" y2="35" stroke={primaryColor} strokeWidth="1.5" opacity="0.6" />
        <line x1="50" y1="50" x2="65" y2="35" stroke={primaryColor} strokeWidth="1.5" opacity="0.6" />
        <line x1="50" y1="50" x2="50" y2="70" stroke={primaryColor} strokeWidth="1.5" opacity="0.6" />

        {/* Central Core */}
        <circle cx="50" cy="50" r="10" fill={primaryColor} />
        
        {/* Child Core Nodes */}
        <circle cx="35" cy="35" r="5" fill={primaryColor} />
        <circle cx="65" cy="35" r="5" fill={primaryColor} />
        <circle cx="50" cy="70" r="5" fill={primaryColor} />
      </g>
    </svg>
  );
}
