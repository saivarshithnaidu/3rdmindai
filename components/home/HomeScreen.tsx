'use client';

import React, { useState } from 'react';
import GoalInput from './GoalInput';
import QuickChips from './QuickChips';
import { motion } from 'framer-motion';
import { Search, Code, PenTool } from 'lucide-react';

interface HomeScreenProps {
  userName?: string;
  onSubmit: (goal: string, model: string, options?: any) => void;
  isLoading: boolean;
}

const SUGGESTIONS = [
  {
    category: 'Research',
    title: 'Market Analysis',
    desc: 'Research market trends for sustainable running shoes in India.',
    text: 'Analyze current market trends, major competitors, and consumer preferences for eco-friendly running shoes in the Indian metropolitan market.',
    color: '#00D4FF',
    icon: <Search className="w-3.5 h-3.5" />
  },
  {
    category: 'Code',
    title: 'Developer Template',
    desc: 'Create a Next.js landing page template using Tailwind CSS.',
    text: 'Design and build a responsive, modern landing page using Next.js, Tailwind CSS, and Framer Motion with off-white editorial layout styles.',
    color: '#6C47FF',
    icon: <Code className="w-3.5 h-3.5" />
  },
  {
    category: 'Write',
    title: 'Marketing Copy',
    desc: 'Draft an email campaign for a premium brand launch.',
    text: 'Write a sequence of 3 premium email templates for launch, engagement, and early-bird offers targeting a high-end consumer segment.',
    color: '#F59E0B',
    icon: <PenTool className="w-3.5 h-3.5" />
  }
];

export default function HomeScreen({ userName = 'Alex', onSubmit, isLoading }: HomeScreenProps) {
  const [goal, setGoal] = useState('');

  // Determine greeting based on current local time
  const getGreeting = () => {
    const hours = new Date().getHours();
    if (hours < 12) return 'Good morning';
    if (hours < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const handleChipClick = (text: string) => {
    setGoal(text);
  };

  const handleSuggestionClick = (text: string) => {
    setGoal(text);
  };

  // framer-motion variants
  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.08
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { 
      opacity: 1, 
      y: 0, 
      transition: { 
        duration: 0.5, 
        ease: 'easeOut'
      } 
    }
  } as any;

  return (
    <motion.div 
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="w-full flex-1 flex flex-col justify-center items-center px-4 pb-20 select-none font-dmsans"
    >
      <div className="w-full max-w-4xl text-center">
        {/* Cormorant display greeting */}
        <motion.h1 
          variants={itemVariants}
          className="font-syne text-4xl font-normal text-ink tracking-tight flex items-center justify-center gap-2.5"
        >
          <svg className="w-7.5 h-7.5 text-primary shrink-0" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="12" cy="12" r="2.5" />
            <path d="M12 1.5a1 1 0 011 1v3a1 1 0 11-2 0v-3a1 1 0 011-1zm0 15a1 1 0 011 1v3a1 1 0 11-2 0v-3a1 1 0 011-1zM1.5 12a1 1 0 011-1h3a1 1 0 110 2h-3a1 1 0 01-1-1zm15 0a1 1 0 011-1h3a1 1 0 110 2h-3a1 1 0 01-1-1zM4.58 4.58a1 1 0 011.41 0l2.12 2.12a1 1 0 11-1.41 1.41L5.17 6a1 1 0 010-1.41zm11.31 11.31a1 1 0 011.41 0l2.12 2.12a1 1 0 01-1.41 1.41l-2.12-2.12a1 1 0 010-1.41zm-11.31 11.31a1 1 0 010-1.41l2.12-2.12a1 1 0 111.41 1.41l-2.12 2.12a1 1 0 01-1.41 0zm11.31-11.31a1 1 0 010-1.41l2.12-2.12a1 1 0 111.41 1.41l-2.12 2.12a1 1 0 01-1.41 0z" />
          </svg>
          <span>{getGreeting()}, {userName}</span>
        </motion.h1>
        
        {/* Humanist Subtext */}
        <motion.p 
          variants={itemVariants}
          className="mt-1.5 text-muted text-sm font-normal font-dmsans"
        >
          What should 3RDMIND build today?
        </motion.p>

        {/* Input Box */}
        <motion.div variants={itemVariants}>
          <GoalInput
            value={goal}
            onChange={setGoal}
            onSubmit={onSubmit}
            isLoading={isLoading}
          />
        </motion.div>

        {/* Quick Chips */}
        <motion.div variants={itemVariants} className="mt-6">
          <QuickChips onChipClick={handleChipClick} />
        </motion.div>

        {/* Suggestion Cards */}
        <motion.div 
          variants={itemVariants} 
          className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8 w-full max-w-4xl mx-auto"
        >
          {SUGGESTIONS.map((sug, i) => (
            <motion.button
              key={i}
              type="button"
              onClick={() => handleSuggestionClick(sug.text)}
              whileHover={{ y: -3, scale: 1.015 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="bg-surface-card border border-hairline hover:border-primary/50 rounded-xl p-6 text-left transition-all duration-200 cursor-pointer hover:bg-surface-cream-strong flex flex-col justify-between h-36 shadow-xs hover:shadow-sm"
            >
              <div>
                <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider mb-1.5 text-primary">
                  {sug.icon}
                  <span>{sug.category}</span>
                </div>
                <h3 className="text-sm font-normal text-ink leading-tight font-lora">
                  {sug.title}
                </h3>
              </div>
              <p className="text-[11px] text-body line-clamp-2 leading-relaxed">
                {sug.desc}
              </p>
            </motion.button>
          ))}
        </motion.div>
      </div>
    </motion.div>
  );
}
