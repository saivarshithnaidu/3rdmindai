'use client';

import React from 'react';

interface NeuralSymbolProps {
  state?: 'thinking' | 'execution' | 'idle' | 'completed' | 'failed' | 'queued' | 'analyzing' | 'researching' | 'validating' | 'synthesizing' | 'generating_verdict';
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
  
  const isGoldState = state === 'thinking' || state === 'analyzing' || state === 'researching';
  const isPurpleState = state === 'execution' || state === 'validating' || state === 'synthesizing' || state === 'generating_verdict';
  
  if (isGoldState) {
    primaryColor = gold;
    secondaryColor = 'rgba(229, 154, 90, 0.25)';
  } else if (isPurpleState) {
    primaryColor = purple;
    secondaryColor = 'rgba(123, 97, 255, 0.25)';
  } else if (state === 'completed') {
    primaryColor = '#5db872'; // Success green
    secondaryColor = 'rgba(93, 184, 114, 0.2)';
  } else if (state === 'failed') {
    primaryColor = '#c64545'; // Error red
    secondaryColor = 'rgba(198, 69, 69, 0.2)';
  } else {
    // idle / queued
    primaryColor = '#8e8b82'; // muted soft
    secondaryColor = '#e6dfd8';
  }

  // Dynamic animation attributes based on the 8 states
  let orbitAnimation = 'none';
  if (state === 'thinking' || state === 'analyzing') orbitAnimation = 'orbit-rotate-symbol 14s linear infinite';
  else if (state === 'researching') orbitAnimation = 'orbit-rotate-symbol 6s linear infinite';
  else if (isPurpleState) orbitAnimation = 'orbit-rotate-symbol 8s linear infinite';

  let innerAnimation = 'pulse-glow-symbol 2.5s ease-in-out infinite';
  if (isGoldState) {
    innerAnimation = 'neural-pulse-gold 2.5s ease-in-out infinite';
  } else if (isPurpleState) {
    if (state === 'validating') innerAnimation = 'neural-pulse-purple 1.2s ease-in-out infinite';
    else if (state === 'generating_verdict') innerAnimation = 'neural-pulse-purple 1.8s ease-in-out infinite';
    else innerAnimation = 'neural-pulse-purple 2.2s ease-in-out infinite';
  } else if (state === 'completed' || state === 'failed' || state === 'idle' || state === 'queued') {
    innerAnimation = 'none';
  }

  const isAnimatedTrack = isGoldState || isPurpleState;

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
        @keyframes neural-pulse-gold {
          0%, 100% { transform: scale(0.95); opacity: 0.8; filter: drop-shadow(0 0 1px rgba(229, 154, 90, 0.4)); }
          50% { transform: scale(1.05); opacity: 1; filter: drop-shadow(0 0 6px rgba(229, 154, 90, 0.8)); }
        }
        @keyframes neural-pulse-purple {
          0%, 100% { transform: scale(0.95); opacity: 0.8; filter: drop-shadow(0 0 1px rgba(123, 97, 255, 0.4)); }
          50% { transform: scale(1.05); opacity: 1; filter: drop-shadow(0 0 8px rgba(123, 97, 255, 0.8)); }
        }
        @keyframes dash-symbol {
          to { stroke-dashoffset: -40; }
        }
        .symbol-orbit-path {
          transform-origin: center;
          animation: ${orbitAnimation};
        }
        .symbol-inner-core {
          transform-origin: center;
          animation: ${innerAnimation};
        }
        .symbol-dash-path {
          stroke-dasharray: 8 4;
          animation: dash-symbol 4s linear infinite;
        }
      `}</style>
      
      {/* Outer Glow Halo */}
      {isAnimatedTrack && (
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
      <g className="symbol-orbit-path">
        {/* Orbital Track */}
        <circle
          cx="50"
          cy="50"
          r="28"
          fill="none"
          stroke={primaryColor}
          strokeWidth="1"
          opacity={state === 'idle' || state === 'queued' ? '0.1' : '0.25'}
          className={isAnimatedTrack ? 'symbol-dash-path' : ''}
        />
        
        {/* Outer orbital nodes */}
        <circle cx="50" cy="10" r="4" fill={primaryColor} />
        <circle cx="50" cy="90" r="4" fill={primaryColor} />
        <circle cx="10" cy="50" r="4" fill={primaryColor} />
        <circle cx="90" cy="50" r="4" fill={primaryColor} />
      </g>

      {/* Inner Central Mind Node Network */}
      <g className="symbol-inner-core">
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
