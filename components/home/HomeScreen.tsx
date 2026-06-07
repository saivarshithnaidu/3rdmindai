'use client';

import React, { useState } from 'react';
import GoalInput from './GoalInput';
import QuickChips from './QuickChips';
import { motion } from 'framer-motion';
import { Search, Code, TrendingUp, Globe, Database, Workflow } from 'lucide-react';
import NeuralSymbol from '../workspace/NeuralSymbol';

interface HomeScreenProps {
  userName?: string;
  onSubmit: (goal: string, model: string, options?: any) => void;
  isLoading: boolean;
}

const SUGGESTIONS = [
  {
    category: 'SaaS',
    title: 'Build a SaaS',
    desc: 'Design and launch an automated software project.',
    text: 'Build a software-as-a-service product, including data modeling, API services, and clean frontend UI code.',
    icon: <Code className="w-3.5 h-3.5" />
  },
  {
    category: 'Market',
    title: 'Analyze a Market',
    desc: 'Collect and synthesize competitive intelligence.',
    text: 'Analyze market dynamics, entry barriers, and potential customer segments for a new fintech product.',
    icon: <TrendingUp className="w-3.5 h-3.5" />
  },
  {
    category: 'GTM',
    title: 'Create a GTM Strategy',
    desc: 'Formulate launch and distribution recommendations.',
    text: 'Create a complete Go-To-Market strategy, detailing user acquisition channels, messaging positioning, and launch timeline.',
    icon: <Globe className="w-3.5 h-3.5" />
  },
  {
    category: 'Research',
    title: 'Research Competitors',
    desc: 'Scrape and map competitor features.',
    text: 'Research competitors, feature matrix checklists, pricing structures, and unique selling propositions.',
    icon: <Search className="w-3.5 h-3.5" />
  },
  {
    category: 'System',
    title: 'Design a System',
    desc: 'Architect low-latency system diagrams.',
    text: 'Design a high-availability, low-latency messaging system architecture with database schemas and cache scaling.',
    icon: <Database className="w-3.5 h-3.5" />
  },
  {
    category: 'AI Workflow',
    title: 'Create an AI Workflow',
    desc: 'Chain sub-agents and prompt pipelines.',
    text: 'Create an autonomous multi-agent workflow that listens for webhooks, runs validation steps, and publishes content.',
    icon: <Workflow className="w-3.5 h-3.5" />
  }
];

export default function HomeScreen({ userName = 'Alex', onSubmit, isLoading }: HomeScreenProps) {
  const [goal, setGoal] = useState('');

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
          className="font-syne text-4xl font-normal text-ink tracking-tight flex items-center justify-center gap-3"
        >
          <NeuralSymbol state="thinking" size={32} className="shrink-0" />
          <span>Give 3RDMIND a goal.</span>
        </motion.h1>
        
        {/* Humanist Subtext */}
        <motion.p 
          variants={itemVariants}
          className="mt-2 text-muted text-sm font-normal font-dmsans"
        >
          We'll assemble the right minds.
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
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-8 w-full max-w-4xl mx-auto"
        >
          {SUGGESTIONS.map((sug, i) => (
            <motion.button
              key={i}
              type="button"
              onClick={() => handleSuggestionClick(sug.text)}
              whileHover={{ y: -3, scale: 1.015 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="bg-[#efe9de] border border-[#e6dfd8] hover:border-[#cc785c]/50 rounded-xl p-6 text-left transition-all duration-200 cursor-pointer hover:bg-[#e8e0d2] flex flex-col justify-between h-36 shadow-xs hover:shadow-sm"
            >
              <div>
                <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider mb-1.5 text-[#cc785c]">
                  {sug.icon}
                  <span>{sug.category}</span>
                </div>
                <h3 className="text-sm font-normal text-[#141413] leading-tight font-lora">
                  {sug.title}
                </h3>
              </div>
              <p className="text-[11px] text-[#3d3d3a] line-clamp-2 leading-relaxed">
                {sug.desc}
              </p>
            </motion.button>
          ))}
        </motion.div>
      </div>
    </motion.div>
  );
}

