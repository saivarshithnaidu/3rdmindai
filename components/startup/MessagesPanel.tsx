'use client';

import React, { useState, useEffect } from 'react';
import { AgentMessage, StartupAgent, AgentRole } from '../../types';
import { Mail, MailOpen, Send, ChevronDown, ChevronUp, Loader2, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface MessagesPanelProps {
  agentId: string;
  projectId: string;
}

const roleColors: Record<AgentRole, string> = {
  ceo: 'bg-blue-50 text-blue-600 border-blue-200/50',
  cmo: 'bg-purple-50 text-purple-600 border-purple-200/50',
  cto: 'bg-teal-50 text-teal-600 border-teal-200/50',
  cfo: 'bg-amber-50 text-amber-600 border-amber-200/50',
  cso: 'bg-rose-50 text-rose-600 border-rose-200/50',
  cro: 'bg-green-50 text-green-600 border-green-200/50',
};

export default function MessagesPanel({ agentId, projectId }: MessagesPanelProps) {
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [agents, setAgents] = useState<StartupAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [folder, setFolder] = useState<'inbox' | 'sent'>('inbox');
  const [expandedMsgId, setExpandedMsgId] = useState<string | null>(null);

  const loadMessages = async () => {
    try {
      const res = await fetch(`/api/startup-agents/messages?agentId=${agentId}`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
      }

      const agentsRes = await fetch(`/api/startup-agents/list?projectId=${projectId}`);
      if (agentsRes.ok) {
        const data = await agentsRes.json();
        setAgents(data.agents || []);
      }
    } catch (err) {
      console.error('Failed to load messages:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMessages();
  }, [agentId]);

  const agentMap = agents.reduce((acc, a) => {
    acc[a.id] = { name: a.name, role: a.role };
    return acc;
  }, {} as Record<string, { name: string; role: AgentRole }>);

  // Filter messages
  const filteredMessages = messages.filter((m) =>
    folder === 'inbox' ? m.to_agent_id === agentId : m.from_agent_id === agentId
  );

  const handleToggleExpand = async (msg: AgentMessage) => {
    const isExpanding = expandedMsgId !== msg.id;
    setExpandedMsgId(isExpanding ? msg.id : null);

    if (isExpanding && folder === 'inbox' && !msg.read) {
      try {
        const res = await fetch('/api/startup-agents/messages/read', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messageId: msg.id }),
        });

        if (res.ok) {
          // Update status locally
          setMessages((prev) =>
            prev.map((item) => (item.id === msg.id ? { ...item, read: true } : item))
          );
        }
      } catch (err) {
        console.warn('Failed to mark message as read:', err);
      }
    }
  };

  return (
    <div className="space-y-4 font-dmsans h-full flex flex-col">
      {/* Folder Selection tabs */}
      <div className="flex border-b border-[#E5E0DA] pb-3 justify-between items-center">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              setFolder('inbox');
              setExpandedMsgId(null);
            }}
            className={`text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-full border transition-all cursor-pointer ${
              folder === 'inbox'
                ? 'bg-[#191919] text-white border-transparent'
                : 'bg-white border-[#E5E0DA] text-[#5E5B56] hover:bg-[#F4F0EB]'
            }`}
          >
            Inbox
          </button>

          <button
            type="button"
            onClick={() => {
              setFolder('sent');
              setExpandedMsgId(null);
            }}
            className={`text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-full border transition-all cursor-pointer ${
              folder === 'sent'
                ? 'bg-[#191919] text-white border-transparent'
                : 'bg-white border-[#E5E0DA] text-[#5E5B56] hover:bg-[#F4F0EB]'
            }`}
          >
            Sent
          </button>
        </div>

        {folder === 'inbox' && filteredMessages.some((m) => !m.read) && (
          <span className="text-[9px] bg-red-50 text-red-600 border border-red-200 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider animate-pulse">
            New
          </span>
        )}
      </div>

      {/* Message Feed */}
      <div className="flex-1 overflow-y-auto pr-1">
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-[#85827D]" />
          </div>
        ) : filteredMessages.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-[#E5E0DA] rounded-2xl bg-[#FBF9F6]">
            {folder === 'inbox' ? (
              <MailOpen className="w-6 h-6 text-[#85827D] mx-auto mb-2 opacity-50" />
            ) : (
              <Send className="w-6 h-6 text-[#85827D] mx-auto mb-2 opacity-50" />
            )}
            <p className="text-[11px] text-[#5E5B56] font-semibold">
              {folder === 'inbox' ? 'Inbox is empty.' : 'No sent messages.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredMessages.map((msg) => {
              const participantId = folder === 'inbox' ? msg.from_agent_id : msg.to_agent_id;
              const participant = agentMap[participantId] || { name: 'Agent', role: 'ceo' };
              const colorClass = roleColors[participant.role] || 'bg-gray-50 text-gray-600 border-gray-200';
              const isExpanded = expandedMsgId === msg.id;

              return (
                <div
                  key={msg.id}
                  className={`bg-white border rounded-2xl p-4 transition-all space-y-3 border-l-4 ${
                    folder === 'inbox' && !msg.read
                      ? 'border-l-[#D97757] border-[#D97757]/30 shadow-[0_2px_8px_rgba(217,119,87,0.03)]'
                      : 'border-l-[#E5E0DA] border-[#E5E0DA]'
                  }`}
                >
                  {/* Message Top bar */}
                  <div
                    onClick={() => handleToggleExpand(msg)}
                    className="flex items-start justify-between gap-3 cursor-pointer"
                  >
                    <div className="flex flex-col gap-1.5 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border ${colorClass}`}>
                          {participant.role.toUpperCase()}
                        </span>
                        <span className="text-xs font-extrabold text-[#191919] truncate">
                          {participant.name}
                        </span>
                      </div>
                      <h4 className="text-xs font-bold text-[#191919] leading-snug">
                        {msg.subject}
                      </h4>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[9px] text-[#85827D] font-bold">
                        {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {isExpanded ? <ChevronUp className="w-4 h-4 text-[#85827D]" /> : <ChevronDown className="w-4 h-4 text-[#85827D]" />}
                    </div>
                  </div>

                  {/* Expanded Content preview */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="space-y-3 pt-2.5 border-t border-[#E5E0DA] overflow-hidden"
                      >
                        <p className="text-xs text-[#5E5B56] leading-relaxed whitespace-pre-wrap font-medium">
                          {msg.content}
                        </p>

                        {/* Reply Task status */}
                        {msg.reply_task_id && (
                          <div className="flex items-center gap-1.5 p-2 bg-[#FBF9F6] border border-[#E5E0DA] rounded-xl text-[10px] text-[#85827D] font-bold uppercase tracking-wider">
                            <ArrowRight className="w-3.5 h-3.5 text-[#D97757]" />
                            <span>Queued follow-up response task</span>
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
