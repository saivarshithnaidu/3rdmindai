'use client';

import React from 'react';
import { ToggleLeft, ToggleRight, Settings, ExternalLink, ShieldAlert } from 'lucide-react';
import * as Icons from 'lucide-react';

interface ConnectorCardProps {
  connector: {
    slug: string;
    name: string;
    category: string;
    description: string;
    authType: 'api_key' | 'oauth' | 'none';
    icon: string;
    docsUrl: string;
    isConnected?: boolean;
    toolsAvailable?: number;
    tools: string[];
  };
  onConnectClick: () => void;
  onDisconnectClick: () => void;
}

function ConnectorIcon({ name, className }: { name?: string; className?: string }) {
  if (!name) return <Icons.Plug className={className} />;
  
  if (name.startsWith('ti-')) {
    return <i className={`ti ${name} text-xl text-primary`} />;
  }
  
  const IconComponent = (Icons as any)[name] || Icons.Plug;
  return <IconComponent className={className} />;
}

export default function ConnectorCard({
  connector,
  onConnectClick,
  onDisconnectClick,
}: ConnectorCardProps) {
  const isConnected = !!connector.isConnected;
  const toolsCount = connector.toolsAvailable !== undefined ? connector.toolsAvailable : connector.tools.length;

  return (
    <div className="flex flex-col bg-canvas border border-hairline hover:border-primary/50 rounded-xl p-4 transition-all duration-200 shadow-2xs hover:shadow-xs group">
      {/* Top Header */}
      <div className="flex items-start justify-between gap-3 mb-2.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-surface-soft text-muted group-hover:bg-surface-card flex items-center justify-center border border-hairline transition-colors shrink-0">
            <ConnectorIcon name={connector.icon} className="w-5 h-5 text-primary" />
          </div>
          <div className="min-w-0">
            <h4 className="font-lora font-normal text-sm text-ink tracking-tight truncate">
              {connector.name}
            </h4>
            <span className="text-[9px] bg-surface-card text-ink px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider">
              {connector.category}
            </span>
          </div>
        </div>

        {/* Status indicator */}
        <div className="flex items-center gap-1 shrink-0">
          {isConnected ? (
            <span className="flex items-center gap-1 text-[10px] text-success bg-success/10 border border-success/25 px-2 py-0.5 rounded-full font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
              Connected
            </span>
          ) : (
            <span className="text-[10px] text-muted bg-surface-soft border border-hairline px-2 py-0.5 rounded-full font-bold">
              Offline
            </span>
          )}
        </div>
      </div>

      {/* Description */}
      <p className="text-xs text-body font-normal leading-relaxed mb-4 flex-1 line-clamp-2">
        {connector.description}
      </p>

      {/* Available tools sub-text */}
      <div className="text-[11px] text-muted-soft mb-3 font-medium">
        {isConnected ? (
          <span className="text-primary font-semibold">{toolsCount} tools available</span>
        ) : (
          <span>{connector.tools.length} tools registered</span>
        )}
      </div>

      {/* Footer Controls */}
      <div className="flex items-center justify-between pt-3 border-t border-hairline mt-auto">
        {/* Docs Links */}
        {connector.docsUrl ? (
          <a
            href={connector.docsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] font-bold text-muted hover:text-primary transition-colors flex items-center gap-1 cursor-pointer"
          >
            <span>Docs</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        ) : (
          <div className="w-1 h-1" />
        )}

        {/* Connect Actions */}
        <div className="flex items-center gap-1.5">
          {isConnected ? (
            <>
              {connector.authType === 'api_key' && (
                <button
                  type="button"
                  onClick={onConnectClick}
                  className="p-1.5 hover:bg-surface-soft text-muted hover:text-ink rounded-lg transition-colors border border-hairline cursor-pointer shadow-2xs"
                  title="Configure API key"
                >
                  <Settings className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                type="button"
                onClick={onDisconnectClick}
                className="flex items-center gap-1 text-xs font-semibold text-error hover:text-error/80 bg-error/8 hover:bg-error/15 px-3 py-1.5 rounded-lg border border-error/25 transition-colors cursor-pointer"
              >
                <ToggleRight className="w-4 h-4 shrink-0" />
                <span>Disconnect</span>
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={onConnectClick}
              className="flex items-center gap-1 text-xs font-semibold text-on-primary bg-primary hover:bg-primary-active px-3 py-1.5 rounded-lg border border-transparent transition-all duration-150 cursor-pointer shadow-sm hover:shadow-md"
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
