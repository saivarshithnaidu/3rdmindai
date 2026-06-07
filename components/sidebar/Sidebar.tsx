'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Project } from '../../types';
import NavItem from './NavItem';
import ProjectList from './ProjectList';
import { motion } from 'framer-motion';
import { 
  Plus, 
  Search, 
  Sliders,
  MessageSquare,
  Bot,
  LayoutGrid,
  Brain, 
  Settings, 
  PanelLeftClose, 
  PanelLeft,
  ChevronsUpDown,
  Plug
} from 'lucide-react';

interface SidebarProps {
  projects: Project[];
  activeProjectId?: string;
  isCollapsed: boolean;
  setIsCollapsed: (val: boolean) => void;
  onNavClick?: (label: string) => void;
  activeNavItem?: string;
}

export default function Sidebar({ 
  projects, 
  activeProjectId, 
  isCollapsed, 
  setIsCollapsed,
  onNavClick,
  activeNavItem = 'Chats'
}: SidebarProps) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [connectedCount, setConnectedCount] = useState(0);

  useEffect(() => {
    fetch('/api/connectors/list?userId=00000000-0000-0000-0000-000000000000')
      .then(res => res.json())
      .then(data => {
        if (data && Array.isArray(data.connectors)) {
          const count = data.connectors.filter((c: any) => c.isConnected).length;
          setConnectedCount(count);
        }
      })
      .catch(err => console.warn('Failed to fetch connector count in sidebar:', err));
  }, []);

  const filteredProjects = projects.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (isCollapsed) {
    return (
      <div className="w-16 h-screen bg-[#F4F0EB] border-r border-[#E5E0DA] flex flex-col items-center py-4 justify-between shrink-0 transition-all duration-200 select-none">
        <div className="flex flex-col items-center gap-6">
          <button 
            type="button"
            onClick={() => setIsCollapsed(false)}
            className="p-2 hover:bg-[#E9E3DB] rounded-lg text-[#5E5B56] hover:text-[#191919] transition-colors cursor-pointer"
          >
            <PanelLeft className="w-5 h-5" />
          </button>
          
          <button 
            type="button"
            onClick={() => router.push('/workspace')}
            className="p-2 bg-[#FFFFFF] border border-[#E5E0DA] text-[#191919] hover:bg-[#F9F8F6] rounded-full transition-colors cursor-pointer shadow-sm"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 rounded-full bg-[#191919] text-[#FFFFFF] flex items-center justify-center text-xs font-semibold">
            AS
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-[240px] h-screen bg-[#F4F0EB] border-r border-[#E5E0DA] flex flex-col shrink-0 transition-all duration-200 select-none font-dmsans">
      {/* Top Header */}
      <div className="flex items-center justify-between p-4 border-b border-[#E5E0DA]">
        <div className="flex items-center gap-2">
          {/* Terracotta brand dot */}
          <motion.div 
            animate={{ opacity: [1, 0.5, 1] }}
            transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
            className="w-2.5 h-2.5 rounded-full bg-[#D97757]"
            style={{ boxShadow: '0 0 8px rgba(217, 119, 87, 0.4)' }}
          />
          <button 
            type="button"
            onClick={() => router.push('/workspace')}
            className="font-lora text-lg font-bold tracking-wide text-[#191919] hover:opacity-80 transition-opacity cursor-pointer text-left"
          >
            3RDMIND
          </button>
        </div>
        <button 
          type="button"
          onClick={() => setIsCollapsed(true)}
          className="p-1.5 hover:bg-[#E9E3DB] rounded-lg text-[#5E5B56] hover:text-[#191919] transition-colors cursor-pointer"
        >
          <PanelLeftClose className="w-4 h-4" />
        </button>
      </div>

      {/* Action Buttons */}
      <div className="p-3 space-y-2">
        <button
          type="button"
          onClick={() => router.push('/workspace')}
          className="w-full flex items-center justify-center gap-2 bg-[#FFFFFF] hover:bg-[#F9F8F6] hover:bg-[#ECE5DD] border border-[#E5E0DA] text-[#191919] rounded-full py-2 text-sm font-medium transition-colors cursor-pointer shadow-sm"
        >
          <Plus className="w-4 h-4 text-[#85827D]" />
          <span>New chat</span>
        </button>

        {/* Search */}
        <div className="relative px-1">
          <Search className="absolute left-4 top-2.5 w-4 h-4 text-[#85827D]" />
          <input
            type="text"
            placeholder="Search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-transparent border border-transparent hover:bg-[#E9E3DB] rounded-lg pl-9 pr-3 py-1.5 text-sm text-[#191919] placeholder-[#5E5B56] focus:outline-none focus:bg-[#FFFFFF] focus:border-[#E5E0DA] focus:shadow-2xs transition-all duration-150 font-dmsans cursor-pointer focus:cursor-text"
          />
        </div>

        {/* Customize */}
        <div className="px-1">
          <NavItem 
            label="Customize" 
            icon={<Sliders className="w-4 h-4" />} 
            active={activeNavItem === 'Customize'}
            onClick={() => {
              if (onNavClick) onNavClick('Customize');
            }}
          />
        </div>
      </div>

      <div className="h-px bg-[#E5E0DA] my-1 mx-3" />

      {/* Main Navigation */}
      <div className="px-2.5 space-y-0.5">
        <NavItem 
          label="Chats" 
          icon={<MessageSquare className="w-4 h-4" />} 
          active={activeNavItem === 'Chats'}
          onClick={() => {
            if (onNavClick) onNavClick('Chats');
          }}
        />
        <NavItem 
          label="Agents" 
          icon={<Bot className="w-4 h-4" />} 
          active={activeNavItem === 'Agents'}
          onClick={() => {
            if (onNavClick) onNavClick('Agents');
          }}
        />
        <NavItem 
          label="Artifacts" 
          icon={<LayoutGrid className="w-4 h-4" />} 
          active={activeNavItem === 'Artifacts'}
          onClick={() => {
            if (onNavClick) onNavClick('Artifacts');
          }}
        />
        <NavItem 
          label="Memory" 
          icon={<Brain className="w-4 h-4" />} 
          active={activeNavItem === 'Memory'}
          onClick={() => {
            if (onNavClick) onNavClick('Memory');
          }}
        />
        <NavItem 
          label="Connectors" 
          icon={<i className="ti ti-plug-connected text-sm" />} 
          active={activeNavItem === 'Connectors'}
          onClick={() => {
            router.push('/connectors');
            if (onNavClick) onNavClick('Connectors');
          }}
          badge={connectedCount > 0 ? (
            <span className="bg-primary/20 text-primary px-1.5 py-0.5 rounded-full text-[9px] font-bold">
              {connectedCount}
            </span>
          ) : null}
        />
        <NavItem 
          label="Team" 
          icon={<i className="ti ti-users text-sm" />} 
          active={activeNavItem === 'Team'}
          onClick={() => {
            if (activeProjectId) {
              router.push(`/startup/${activeProjectId}`);
            } else {
              router.push('/workspace');
            }
            if (onNavClick) onNavClick('Team');
          }}
          badge={(
            <span className="bg-primary/20 text-primary px-1.5 py-0.5 rounded-full text-[9px] font-bold">
              6
            </span>
          )}
        />
        <NavItem 
          label="Price Watch" 
          icon={<i className="ti ti-tag text-sm" />} 
          active={activeNavItem === 'Price Watch'}
          onClick={() => {
            if (activeProjectId) {
              router.push(`/price-watch?projectId=${activeProjectId}`);
            } else {
              router.push('/price-watch');
            }
            if (onNavClick) onNavClick('Price Watch');
          }}
        />
      </div>

      <div className="h-px bg-[#E5E0DA] my-1 mx-3" />

      {/* Recent Projects List */}
      <div className="flex-1 mt-4 px-3 overflow-hidden flex flex-col">
        <div className="text-[11px] font-bold text-[#85827D] px-3 mb-1.5 font-dmsans">
          Recents
        </div>
        <ProjectList projects={filteredProjects} activeProjectId={activeProjectId} />
      </div>

      {/* Bottom User Profile */}
      <div className="p-3.5 border-t border-[#E5E0DA] bg-[#F4F0EB] flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-full bg-[#191919] text-[#FFFFFF] flex items-center justify-center font-bold text-sm shrink-0 ring-2 ring-amber-400/30">
            AS
          </div>
          <div className="min-w-0">
            <div className="text-xs font-semibold text-[#191919] truncate">
              Alex Smith
            </div>
            <div className="text-[10px] text-[#9A6B24] bg-[#F5EAD4] border border-[#E8DAB7] px-1.5 py-0.5 rounded-full inline-block font-bold mt-0.5">
              PRO
            </div>
          </div>
        </div>
        <button type="button" className="text-[#85827D] hover:text-[#191919] transition-colors p-1 rounded hover:bg-[#E9E3DB] cursor-pointer">
          <ChevronsUpDown className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
