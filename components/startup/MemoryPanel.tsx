'use client';

import React, { useState, useEffect } from 'react';
import { AgentMemory, MemoryType } from '../../types';
import { Brain, Plus, X, Check, Loader2, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface MemoryPanelProps {
  agentId: string;
  projectId: string;
  agentName?: string;
}

const typeColors: Record<MemoryType, string> = {
  decision: 'bg-blue-50 text-blue-700 border-blue-100',
  fact: 'bg-teal-50 text-teal-700 border-teal-100',
  learning: 'bg-green-50 text-green-700 border-green-100',
  preference: 'bg-amber-50 text-amber-700 border-amber-100',
  output: 'bg-purple-50 text-purple-700 border-purple-100',
};

export default function MemoryPanel({ agentId, projectId, agentName = 'Agent' }: MemoryPanelProps) {
  const [memories, setMemories] = useState<AgentMemory[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [newType, setNewType] = useState<MemoryType>('fact');
  const [newContent, setNewContent] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  const loadMemories = async (query = '') => {
    setLoading(true);
    try {
      const q = query.trim();
      const url = `/api/startup-agents/memory?agentId=${agentId}&projectId=${projectId}&limit=50` + 
        (q ? `&query=${encodeURIComponent(q)}` : '');
      
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setMemories(data.memory || []);
      }
    } catch (err) {
      console.error('Failed to load memories:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMemories(searchQuery);
  }, [agentId, searchQuery]);

  const handleAddMemory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContent.trim()) return;

    setSubmitting(true);
    try {
      const res = await fetch('/api/startup-agents/memory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId,
          projectId,
          memoryType: newType,
          content: newContent,
        }),
      });

      if (res.ok) {
        setNewContent('');
        setIsAdding(false);
        setSearchQuery('');
        loadMemories('');
      }
    } catch (err) {
      console.error('Failed to save memory:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetMemory = async () => {
    const confirm = window.confirm('Are you sure you want to reset all memories for this agent? This action cannot be undone.');
    if (!confirm) return;

    setLoading(true);
    try {
      const supabase = (await import('../../services/supabase.service')).default.getServiceClient();
      const { error } = await supabase
        .from('agent_memory')
        .delete()
        .eq('agent_id', agentId);
      
      if (error) throw error;
      setSearchQuery('');
      loadMemories('');
    } catch (err) {
      console.error('Failed to reset memory:', err);
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4 font-dmsans h-full flex flex-col justify-between">
      <div className="space-y-4 flex-1 overflow-y-auto pr-1">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#E5E0DA] pb-3">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#85827D]">
            <Brain className="w-4 h-4 text-[#D97757]" />
            <span>Memory Core</span>
          </div>

          <button
            type="button"
            onClick={() => setIsAdding(!isAdding)}
            className="p-1 hover:bg-[#F4F0EB] text-[#5E5B56] hover:text-[#191919] rounded-lg transition-colors cursor-pointer"
          >
            {isAdding ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          </button>
        </div>

        {/* Search Input */}
        <div className="relative">
          <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-[#85827D]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`Search ${agentName}'s memory...`}
            className="w-full bg-[#FBF9F6] border border-[#E5E0DA] rounded-xl pl-9 pr-3 py-2 text-xs text-[#191919] placeholder-[#85827D] focus:outline-none focus:border-[#D97757] transition-all font-medium"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-2.5 text-xs text-[#85827D] hover:text-[#191919] cursor-pointer"
            >
              Clear
            </button>
          )}
        </div>

        {/* Add Memory Form */}
        <AnimatePresence>
          {isAdding && (
            <motion.form
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              onSubmit={handleAddMemory}
              className="bg-[#FBF9F6] border border-[#E5E0DA] rounded-2xl p-4 space-y-3 overflow-hidden"
            >
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-[#5E5B56] mb-1.5">
                  Type
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {(['fact', 'decision', 'learning', 'preference'] as MemoryType[]).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setNewType(t)}
                      className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md border transition-all cursor-pointer ${
                        newType === t
                          ? 'bg-[#191919] text-white border-transparent'
                          : 'bg-white border-[#E5E0DA] text-[#5E5B56] hover:bg-[#F4F0EB]'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label htmlFor="memContent" className="block text-[10px] font-bold uppercase tracking-wider text-[#5E5B56] mb-1.5">
                  Memory Description
                </label>
                <textarea
                  id="memContent"
                  rows={3}
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  placeholder="Record key learning or project fact..."
                  className="w-full bg-white border border-[#E5E0DA] rounded-xl px-3 py-2 text-xs text-[#191919] focus:outline-none focus:border-[#D97757] transition-all resize-none"
                />
              </div>

              <button
                type="submit"
                disabled={submitting || !newContent.trim()}
                className="w-full flex items-center justify-center gap-1.5 bg-[#D97757] hover:bg-[#c66545] disabled:bg-[#ECE5DD] disabled:text-[#85827D] text-white rounded-xl py-2 text-xs font-bold transition-all cursor-pointer"
              >
                {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                <span>Save memory</span>
              </button>
            </motion.form>
          )}
        </AnimatePresence>

        {/* Memory List */}
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-[#85827D]" />
          </div>
        ) : memories.length === 0 ? (
          <div className="text-center py-10 border border-dashed border-[#E5E0DA] rounded-2xl bg-[#FBF9F6]">
            <Brain className="w-6 h-6 text-[#85827D] mx-auto mb-2 opacity-50" />
            <p className="text-[11px] text-[#5E5B56] font-semibold">
              {searchQuery ? 'No matching memories found.' : 'No memories established yet.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {memories.map((mem: any) => (
              <div
                key={mem.id}
                className="bg-white border border-[#E5E0DA] rounded-2xl p-3.5 space-y-2 relative overflow-hidden"
              >
                <div className="flex items-center justify-between">
                  <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${typeColors[mem.memory_type as MemoryType] || 'bg-gray-50 text-gray-700'}`}>
                    {mem.memory_type}
                  </span>
                  
                  {mem.similarity !== undefined && (
                    <span className="text-[9px] bg-green-50 border border-green-200/50 text-green-700 px-1.5 py-0.5 rounded font-mono font-bold">
                      {Math.round(mem.similarity * 100)}% Match
                    </span>
                  )}
                  
                  {mem.similarity === undefined && mem.created_at && (
                    <span className="text-[9px] text-[#85827D] font-bold">
                      {new Date(mem.created_at).toLocaleDateString()}
                    </span>
                  )}
                </div>
                <p className="text-xs text-[#191919] font-medium leading-relaxed">
                  {mem.content}
                </p>
                {mem.source_task_id && (
                  <div className="text-[9px] text-[#85827D] italic mt-1 font-medium">
                    Source: Task Output
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Reset Button */}
      {memories.length > 0 && !searchQuery && (
        <div className="pt-4 border-t border-[#E5E0DA]">
          <button
            type="button"
            onClick={handleResetMemory}
            className="w-full bg-red-50 hover:bg-red-100 text-red-600 border border-red-200/50 rounded-xl py-2.5 text-xs font-bold transition-all cursor-pointer"
          >
            Reset Memory Core
          </button>
        </div>
      )}
    </div>
  );
}
