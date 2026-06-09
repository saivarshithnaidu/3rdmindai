'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Play, Square, FileText, CheckCircle2, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Speech {
  speaker: string;
  name: string;
  text: string;
}

interface BoardMeetingViewProps {
  projectId: string;
  onMinutesGenerated: (minutes: string) => void;
  onResolutionProposed: () => void;
}

export default function BoardMeetingView({
  projectId,
  onMinutesGenerated,
  onResolutionProposed
}: BoardMeetingViewProps) {
  const [status, setStatus] = useState<'idle' | 'running' | 'completed'>('idle');
  const [transcript, setTranscript] = useState<Speech[]>([]);
  const [currentSpeechIndex, setCurrentSpeechIndex] = useState(0);
  const [minutes, setMinutes] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeSpeakerText, setActiveSpeakerText] = useState('');
  const textIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const conveneMeeting = async () => {
    setLoading(true);
    setStatus('idle');
    setTranscript([]);
    setCurrentSpeechIndex(0);
    setActiveSpeakerText('');
    
    try {
      const res = await fetch('/api/board/convene', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId })
      });
      const data = await res.json();
      
      if (data.success) {
        setTranscript(data.transcript);
        setMinutes(data.minutes);
        onMinutesGenerated(data.minutes);
        setStatus('running');
        playSpeech(data.transcript, 0);
      }
    } catch (err) {
      console.error('Failed to convene board meeting:', err);
    } finally {
      setLoading(false);
    }
  };

  const playSpeech = (speechList: Speech[], index: number) => {
    if (index >= speechList.length) {
      setStatus('completed');
      onResolutionProposed(); // Notify parent to refresh resolutions
      return;
    }

    setCurrentSpeechIndex(index);
    const speech = speechList[index];
    let charIndex = 0;
    setActiveSpeakerText('');

    if (textIntervalRef.current) clearInterval(textIntervalRef.current);

    // Typing speed speedup to ensure snappy simulation
    const msPerChar = 15; 
    textIntervalRef.current = setInterval(() => {
      if (charIndex < speech.text.length) {
        setActiveSpeakerText((prev) => prev + speech.text[charIndex]);
        charIndex++;
      } else {
        clearInterval(textIntervalRef.current!);
        // Wait 3 seconds at end of speech, then next speaker
        setTimeout(() => {
          playSpeech(speechList, index + 1);
        }, 3000);
      }
    }, msPerChar);
  };

  useEffect(() => {
    return () => {
      if (textIntervalRef.current) clearInterval(textIntervalRef.current);
    };
  }, []);

  const skipMeeting = () => {
    if (textIntervalRef.current) clearInterval(textIntervalRef.current);
    setCurrentSpeechIndex(transcript.length);
    setStatus('completed');
    onResolutionProposed();
  };

  // Map roles to background colors
  const roleColors: Record<string, string> = {
    CEO: 'bg-[#cc785c] text-white',
    CTO: 'bg-[#5db8a6] text-white',
    CMO: 'bg-[#e8a55a] text-white',
    CFO: 'bg-[#5db872] text-white',
    CSO: 'bg-[#d4a017] text-white',
    CRO: 'bg-[#c64545] text-white',
  };

  return (
    <div className="bg-[#FFFFFF] border border-[#E5E0DA] rounded-2xl p-6 shadow-2xs text-left">
      <div className="flex items-center justify-between border-b border-hairline pb-4 mb-6">
        <div>
          <h2 className="font-serif text-xl font-normal text-ink">Boardroom Simulator</h2>
          <p className="text-xs text-muted mt-0.5">Convene an official strategic alignment meeting of all AI Directors.</p>
        </div>

        {status === 'idle' && (
          <button
            onClick={conveneMeeting}
            disabled={loading}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#cc785c] hover:bg-[#a9583e] text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer disabled:opacity-50"
          >
            {loading ? (
              <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Play className="w-3.5 h-3.5 fill-white" />
            )}
            <span>{loading ? 'Assembling Directors...' : 'Convene Board Meeting'}</span>
          </button>
        )}

        {status === 'running' && (
          <button
            onClick={skipMeeting}
            className="flex items-center gap-1.5 px-4 py-2 bg-surface-cream-strong hover:bg-surface-cream-strong/80 text-ink border border-hairline rounded-xl text-xs font-bold transition-all cursor-pointer"
          >
            <Square className="w-3.5 h-3.5" />
            <span>Adjourn Instantly</span>
          </button>
        )}

        {status === 'completed' && (
          <button
            onClick={conveneMeeting}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#cc785c] hover:bg-[#a9583e] text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
          >
            <Play className="w-3.5 h-3.5" />
            <span>Re-convene Meeting</span>
          </button>
        )}
      </div>

      <AnimatePresence mode="wait">
        {status === 'idle' && !loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center py-12 text-center max-w-sm mx-auto space-y-4"
          >
            <div className="w-16 h-16 rounded-full bg-[#cc785c]/10 flex items-center justify-center">
              <Play className="w-8 h-8 text-[#cc785c] translate-x-0.5" />
            </div>
            <div className="space-y-1">
              <h3 className="font-serif text-lg font-normal text-ink">Ready to Convene</h3>
              <p className="text-xs text-muted-soft leading-relaxed">
                Clicking Convene will spawn parallel AI agents to outline progress, debate strategic adjustments, write board minutes, and propose a voting resolution.
              </p>
            </div>
          </motion.div>
        )}

        {loading && (
          <div className="flex flex-col items-center justify-center py-16 space-y-3">
            <span className="w-8 h-8 border-4 border-[#cc785c] border-t-transparent rounded-full animate-spin" />
            <span className="text-xs text-muted-soft animate-pulse">Debating company status...</span>
          </div>
        )}

        {status === 'running' && transcript.length > 0 && (
          <motion.div
            key="active-meeting"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="space-y-6"
          >
            {/* Speakers List Highlight Row */}
            <div className="grid grid-cols-6 gap-2">
              {transcript.map((s, idx) => {
                const isActive = idx === currentSpeechIndex;
                return (
                  <div
                    key={idx}
                    className={`flex flex-col items-center p-2 rounded-xl border text-center transition-all ${
                      isActive
                        ? 'bg-surface-cream-strong border-[#cc785c] scale-102 shadow-3xs'
                        : 'bg-surface-soft/40 border-hairline opacity-40'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-full ${roleColors[s.speaker] || 'bg-muted'} flex items-center justify-center font-lora text-sm font-bold`}>
                      {s.speaker[0]}
                    </div>
                    <span className="text-[9px] font-bold text-ink truncate w-full mt-1.5">{s.name.split(' ')[0]}</span>
                    <span className="text-[7px] text-muted-soft uppercase font-extrabold tracking-wider">{s.speaker}</span>
                  </div>
                );
              })}
            </div>

            {/* Active Dialogue Bubble */}
            <div className="bg-[#FAF9F5] border border-[#E5E0DA] rounded-2xl p-6 relative">
              {/* Talking sound wave mock */}
              <div className="absolute top-4 right-4 flex items-center gap-1">
                <span className="w-1.5 h-3 bg-[#cc785c] rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                <span className="w-1.5 h-5 bg-[#cc785c] rounded-full animate-bounce" style={{ animationDelay: '0.3s' }} />
                <span className="w-1.5 h-2 bg-[#cc785c] rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
              </div>

              <div className="flex gap-4">
                <div className={`w-10 h-10 rounded-xl ${roleColors[transcript[currentSpeechIndex]?.speaker] || 'bg-muted'} flex items-center justify-center font-lora text-lg font-bold shrink-0`}>
                  {transcript[currentSpeechIndex]?.speaker[0]}
                </div>
                <div>
                  <div className="flex items-baseline gap-2">
                    <span className="font-serif text-md font-normal text-ink">{transcript[currentSpeechIndex]?.name}</span>
                    <span className="text-[9px] text-[#cc785c] font-bold uppercase bg-[#cc785c]/10 border border-[#cc785c]/10 px-2 py-0.2 rounded-full">
                      {transcript[currentSpeechIndex]?.speaker}
                    </span>
                  </div>
                  <div className="text-xs text-body leading-relaxed mt-2.5 min-h-[40px] font-medium font-inter">
                    {activeSpeakerText}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {status === 'completed' && (
          <motion.div
            key="completed-meeting"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-6"
          >
            <div className="flex items-center gap-3 bg-green-50/50 border border-green-200/50 rounded-xl p-4">
              <CheckCircle2 className="w-5 h-5 text-[#5db872]" />
              <div>
                <h3 className="text-xs font-bold text-ink">Board Meeting Adjourned</h3>
                <p className="text-[11px] text-muted-soft mt-0.5">
                  Meeting concluded successfully. The Board of Directors has proposed a new Board Resolution for voting and compiled corporate minutes.
                </p>
              </div>
            </div>

            {/* Render Meeting Minutes */}
            <div className="border border-hairline rounded-xl bg-surface-soft/20 p-5 overflow-y-auto max-h-[300px]">
              <div className="flex items-center gap-1.5 border-b border-hairline pb-2.5 mb-4 text-xs font-bold text-ink uppercase tracking-wider">
                <FileText className="w-4 h-4 text-muted-soft" />
                <span>Simulated Meeting Minutes</span>
              </div>
              <div className="prose prose-sm font-dmsans text-xs text-body whitespace-pre-wrap leading-relaxed">
                {minutes}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
