'use client';

import React, { useRef, useEffect } from 'react';
import { Agent, Message } from '../../types';
import MessageBubble from './MessageBubble';
import InputBox from './InputBox';
import { Lock } from 'lucide-react';

interface AgentChatProps {
  agent: Agent;
  messages: Message[];
  onOpenPreview?: (code: string, title: string) => void;
}

export default function AgentChat({ agent, messages, onOpenPreview }: AgentChatProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="flex-1 flex flex-col h-full bg-[#FBF9F6] overflow-hidden font-dmsans">
      {/* Top Warning banner indicating read-only */}
      <div className="bg-[#ECE9FC] border-b border-[#D5CFF8] px-4 py-2.5 flex items-center justify-between shrink-0 select-none">
        <div className="flex items-center gap-2">
          <Lock className="w-3.5 h-3.5 text-[#5B39E0]" />
          <span className="text-xs font-semibold text-[#5B39E0]">
            Sub-agent Workspace — {agent.name} ({agent.role})
          </span>
        </div>
        <span className="bg-[#FFFFFF] text-[#5B39E0] text-[10px] font-bold rounded-full px-2.5 py-0.5 uppercase tracking-wider border border-[#D5CFF8] shadow-2xs">
          {agent.model ? `Model: ${agent.model.toLowerCase().includes('gemini') ? 'Gemini 1.5 Pro' : agent.model.toLowerCase().includes('gpt-4o') ? 'GPT-4o' : agent.model.toLowerCase().includes('deepseek') ? 'DeepSeek V3' : agent.model.toLowerCase().includes('llama') ? 'Llama 3 70B' : agent.model.toLowerCase().includes('mistral') ? 'Mistral Large' : agent.model.split('/').pop() || agent.model}` : 'Orchestrator Controlled'}
        </span>
      </div>

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
          {agent.status === 'running' && (
            <div className="flex flex-col items-start w-full font-dmsans space-y-2.5 select-none">
              <div className="flex items-center gap-1.5 text-[10px] font-bold text-[#85827D] uppercase tracking-wider">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 pulse-glow-running" />
                <span>Agent is executing task...</span>
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

      {/* Input box: disabled and showing controlled notice */}
      <InputBox
        onSubmit={() => {}}
        isLoading={false}
        selectedModel={agent.model || 'meta-llama/llama-3-70b-instruct'}
        onModelChange={() => {}}
        placeholder="Only the Orchestrator can write to sub-agents."
        disabled={true}
      />
    </div>
  );
}
