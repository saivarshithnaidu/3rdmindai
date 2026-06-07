'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '../components/sidebar/Sidebar';
import HomeScreen from '../components/home/HomeScreen';
import { Project } from '../types';
import { Loader2 } from 'lucide-react';

interface HomeClientProps {
  initialProjects: Project[];
}

export default function HomeClient({ initialProjects }: HomeClientProps) {
  const router = useRouter();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [activeNavItem, setActiveNavItem] = useState('Chats');

  const handleNavClick = (label: string) => {
    setActiveNavItem(label);
    if (label === 'Customize') {
      alert("Customization option coming soon! Here you can customize system prompts and default agent behavior.");
      setActiveNavItem('Chats');
    } else if (label !== 'Chats' && label !== 'Connectors' && label !== 'Price Watch') {
      alert(`Select a chat session from the Recents list to view its ${label}.`);
      setActiveNavItem('Chats');
    }
  };

  const handleSubmit = async (goal: string, model: string, options?: any) => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/orchestrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goal, model, options }),
      });
      
      if (response.ok) {
        const project = await response.json();
        router.push(`/project/${project.id}`);
        router.refresh();
      } else {
        console.error('Failed to create project workspace and start orchestration');
      }
    } catch (e) {
      console.error('Error initiating project:', e);
    }
  };

  return (
    <div className="flex w-screen h-screen overflow-hidden bg-[#FBF9F6]">
      {/* Left Sidebar */}
      <Sidebar
        projects={initialProjects}
        isCollapsed={isSidebarCollapsed}
        setIsCollapsed={setIsSidebarCollapsed}
        activeNavItem={activeNavItem}
        onNavClick={handleNavClick}
      />
      
      {/* Middle Content Panel */}
      <div className="flex-1 flex flex-col h-full overflow-hidden justify-center items-center">
        <HomeScreen onSubmit={handleSubmit} isLoading={isLoading} />
      </div>
    </div>
  );
}
