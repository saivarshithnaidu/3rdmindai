'use client';

import React from 'react';
import { motion } from 'framer-motion';

interface NavItemProps {
  label: string;
  icon: React.ReactNode;
  active?: boolean;
  onClick?: () => void;
  badge?: React.ReactNode;
}

export default function NavItem({ label, icon, active = false, onClick, badge }: NavItemProps) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{ x: 4 }}
      transition={{ duration: 0.15, ease: 'easeOut' }}
      className={`w-full flex items-center gap-3 px-3 py-2.5 text-xs rounded-xl transition-all duration-200 text-left cursor-pointer font-dmsans ${
        active
          ? 'bg-[#FFFFFF]/90 text-[#191919] font-bold border border-[#E5E0DA] border-l-[3px] border-l-[#D97757] shadow-[0_2px_8px_rgba(25,25,25,0.03)] backdrop-blur-md'
          : 'text-[#5E5B56] hover:bg-[#ECE5DD] hover:text-[#191919] border border-transparent'
      }`}
    >
      <span className={`${active ? 'text-[#D97757]' : 'text-[#85827D]'}`}>{icon}</span>
      <span className="flex-1">{label}</span>
      {badge}
    </motion.button>
  );
}
