'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, ChevronDown, ChevronUp } from 'lucide-react';

interface BriefingPlayerProps {
  audioUrl: string;
  script: string;
  duration?: number;
}

export default function BriefingPlayer({ audioUrl, script, duration }: BriefingPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(duration || 0);
  const [showScript, setShowScript] = useState(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleLoadedMetadata = () => {
      if (audio.duration && isFinite(audio.duration)) {
        setTotalDuration(audio.duration);
      }
    };
    const handleEnded = () => setIsPlaying(false);

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
    };
  }, []);

  const togglePlayPause = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      audio.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    if (!audio || !totalDuration) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = clickX / rect.width;
    audio.currentTime = percentage * totalDuration;
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progressPercent = totalDuration > 0 ? (currentTime / totalDuration) * 100 : 0;

  return (
    <div className="bg-white border border-[#E5E0DA] rounded-xl overflow-hidden font-dmsans shadow-2xs">
      <audio ref={audioRef} src={audioUrl} preload="metadata" />

      {/* Player Controls */}
      <div className="px-4 py-3 flex items-center gap-3">
        {/* Play/Pause Button */}
        <button
          onClick={togglePlayPause}
          className="w-9 h-9 rounded-full bg-[#cc785c] hover:bg-[#a9583e] text-white flex items-center justify-center transition-colors cursor-pointer shrink-0 shadow-sm"
        >
          {isPlaying ? (
            <Pause className="w-4 h-4" />
          ) : (
            <Play className="w-4 h-4 ml-0.5" />
          )}
        </button>

        {/* Progress Bar */}
        <div className="flex-1 flex flex-col gap-1">
          <div
            onClick={handleProgressClick}
            className="w-full h-2 bg-surface-soft rounded-full cursor-pointer group relative"
          >
            <div
              className="h-full bg-[#cc785c] rounded-full transition-all relative"
              style={{ width: `${progressPercent}%` }}
            >
              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-[#cc785c] border-2 border-white shadow-sm opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </div>
        </div>

        {/* Duration Display */}
        <div className="text-[10px] font-semibold text-muted tabular-nums shrink-0">
          {formatTime(currentTime)} / {formatTime(totalDuration)}
        </div>
      </div>

      {/* Collapsible Script Section */}
      <div className="border-t border-[#E5E0DA]">
        <button
          onClick={() => setShowScript(!showScript)}
          className="w-full px-4 py-2 flex items-center justify-between text-xs font-semibold text-muted hover:text-ink transition-colors cursor-pointer bg-surface-soft/30"
        >
          <span>{showScript ? 'Hide Script' : 'Read Script'}</span>
          {showScript ? (
            <ChevronUp className="w-3.5 h-3.5" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5" />
          )}
        </button>

        {showScript && (
          <div className="px-4 py-3 max-h-64 overflow-y-auto text-xs text-ink leading-relaxed whitespace-pre-wrap bg-white">
            {script}
          </div>
        )}
      </div>
    </div>
  );
}
