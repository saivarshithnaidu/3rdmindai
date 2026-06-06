'use client';

import React, { useRef, useEffect } from 'react';
import { Message } from '../../types';
import MessageBubble from './MessageBubble';
import InputBox from './InputBox';

interface OrchestratorChatProps {
  messages: Message[];
  isLoading: boolean;
  selectedModel: string;
  onModelChange: (model: string) => void;
  onSubmit: (content: string, model: string, options?: any) => void;
  projectId?: string;
  onFileUploaded?: (text: string, filename: string) => void;
  onOpenPreview?: (code: string, title: string) => void;
  inputValue?: string;
  onInputValueChange?: (val: string) => void;
  activeCanvasId?: string | null;
  activeArtifactId?: string | null;
}

export default function OrchestratorChat({
  messages,
  isLoading,
  selectedModel,
  onModelChange,
  onSubmit,
  projectId,
  onFileUploaded,
  onOpenPreview,
  inputValue,
  onInputValueChange,
  activeCanvasId,
  activeArtifactId
}: OrchestratorChatProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="flex-1 flex flex-col h-full bg-[#FBF9F6] overflow-hidden font-dmsans">
      {/* Scrollable messages container */}
      <div className="flex-1 overflow-y-auto pt-4 pb-2 px-6 space-y-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {messages.map((message) => (
            <MessageBubble 
              key={message.id} 
              message={message} 
              onOpenPreview={onOpenPreview}
            />
          ))}
          {isLoading && (
            <div className="flex flex-col items-start w-full font-dmsans space-y-2.5 select-none">
              <div className="flex items-center gap-1.5 text-[10px] font-bold text-[#85827D] uppercase tracking-wider">
                <span className="w-1.5 h-1.5 rounded-full bg-[#D97757] pulse-dot" />
                <span>3RDMIND is writing...</span>
              </div>
              <div className="w-full max-w-[500px] bg-[#FFFFFF] border border-[#E5E0DA] rounded-2xl rounded-tl-sm p-5 space-y-3 shadow-[0_1px_3px_rgba(0,0,0,0.01)]">
                <div className="h-2.5 w-4/5 rounded-md bg-[#F4F0EB] animate-shimmer" />
                <div className="h-2.5 w-11/12 rounded-md bg-[#F4F0EB] animate-shimmer" />
                <div className="h-2.5 w-2/3 rounded-md bg-[#F4F0EB] animate-shimmer" />
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input box */}
      <InputBox
        onSubmit={onSubmit}
        isLoading={isLoading}
        selectedModel={selectedModel}
        onModelChange={onModelChange}
        placeholder="Send follow-up to Orchestrator..."
        projectId={projectId}
        onFileUploaded={onFileUploaded}
        inputValue={inputValue}
        onInputValueChange={onInputValueChange}
        activeCanvasId={activeCanvasId}
        activeArtifactId={activeArtifactId}
      />
    </div>
  );
}
