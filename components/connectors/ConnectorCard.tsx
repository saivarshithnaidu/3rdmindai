'use client';

import React from 'react';
import { ToggleLeft, ToggleRight, Settings, ExternalLink, HelpCircle } from 'lucide-react';
import * as Icons from 'lucide-react';

interface ConnectorCardProps {
  connector: {
    id: string;
    name: string;
    category: string;
    description: string;
    authType: 'api_key' | 'oauth' | 'none';
    serverUrl: string;
    isActive: boolean;
    docsUrl?: string;
    icon?: string;
  };
  onConnectClick: () => void;
  onDisconnectClick: () => void;
}

// Helper to resolve dynamic lucide icons safely
function ConnectorIcon({ name, className }: { name?: string; className?: string }) {
  if (!name) return <Icons.Plug className={className} />;
  const IconComponent = (Icons as any)[name] || Icons.Plug;
  return <IconComponent className={className} />;
}

export default function ConnectorCard({
  connector,
  onConnectClick,
  onDisconnectClick,
}: ConnectorCardProps) {
  return (
    <div className="flex flex-col bg-white border border-[#E5E0DA] hover:border-[#D97757]/45 rounded-xl p-4 transition-all duration-200 shadow-2xs hover:shadow-xs group">
      {/* Top Header */}
      <div className="flex items-start justify-between gap-3 mb-2.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-[#F4F0EB] text-[#5E5B56] group-hover:bg-[#EBE5DC] flex items-center justify-center border border-[#E5E0DA]/55 transition-colors shrink-0">
            <ConnectorIcon name={connector.icon} className="w-5 h-5 text-[#D97757]" />
          </div>
          <div className="min-w-0">
            <h4 className="font-lora font-bold text-sm text-[#191919] tracking-tight truncate">
              {connector.name}
            </h4>
            <span className="text-[9px] bg-[#EBE5DC]/75 text-[#5E5B56] px-1.5 py-0.5 rounded-full font-bold">
              {connector.category}
            </span>
          </div>
        </div>

        {/* Status indicator */}
        <div className="flex items-center gap-1">
          {connector.isActive ? (
            <span className="flex items-center gap-1 text-[10px] text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full font-bold shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-green-600 animate-pulse" />
              Connected
            </span>
          ) : (
            <span className="text-[10px] text-[#85827D] bg-[#F4F0EB] border border-[#E5E0DA]/70 px-2 py-0.5 rounded-full font-bold shrink-0">
              Offline
            </span>
          )}
        </div>
      </div>

      {/* Description */}
      <p className="text-xs text-[#5E5B56] font-normal leading-relaxed mb-4 flex-1 line-clamp-2">
        {connector.description}
      </p>

      {/* Footer Controls */}
      <div className="flex items-center justify-between pt-3 border-t border-[#F4F0EB] mt-auto">
        {/* Docs Links */}
        {connector.docsUrl ? (
          <a
            href={connector.docsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] font-bold text-[#85827D] hover:text-[#D97757] transition-colors flex items-center gap-1 cursor-pointer"
          >
            <span>Docs</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        ) : (
          <div className="w-1 h-1" />
        )}

        {/* Connect Actions */}
        <div className="flex items-center gap-1.5">
          {connector.isActive ? (
            <>
              <button
                type="button"
                onClick={onConnectClick}
                className="p-1.5 hover:bg-[#F4F0EB] text-[#5E5B56] hover:text-[#191919] rounded-lg transition-colors border border-[#E5E0DA]/55 cursor-pointer shadow-2xs"
                title="Configure connection"
              >
                <Settings className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={onDisconnectClick}
                className="flex items-center gap-1 text-xs font-semibold text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100/50 px-3 py-1.5 rounded-lg border border-red-200 transition-colors cursor-pointer"
              >
                <ToggleRight className="w-4 h-4 shrink-0" />
                <span>Disconnect</span>
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={onConnectClick}
              className="flex items-center gap-1 text-xs font-semibold text-white bg-[#191919] hover:bg-[#D97757] px-3 py-1.5 rounded-lg border border-transparent transition-all duration-150 cursor-pointer shadow-sm hover:shadow-md"
            >
              <ToggleLeft className="w-4 h-4 shrink-0" />
              <span>Connect</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
