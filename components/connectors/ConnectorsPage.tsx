'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Search, Loader2, ArrowRight, Plug, RefreshCw } from 'lucide-react';
import ConnectorCard from './ConnectorCard';
import ConnectModal from './ConnectModal';

interface Connector {
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
  serverUrl: string;
  keyLabel?: string;
  keyPlaceholder?: string;
  keyDocsUrl?: string;
  scopes?: string[];
}

const CATEGORIES = [
  'All',
  'Productivity',
  'Communication',
  'Developer',
  'Search',
  'Storage',
  'CRM',
  'Finance',
  'AI',
  'Data'
];

export default function ConnectorsPage() {
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [filteredConnectors, setFilteredConnectors] = useState<Connector[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  
  // Connection modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedConnector, setSelectedConnector] = useState<Connector | null>(null);

  const fetchConnectors = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/connectors/list?userId=00000000-0000-0000-0000-000000000000');
      if (response.ok) {
        const data = await response.json();
        setConnectors(data.connectors || []);
      }
    } catch (e) {
      console.error('Failed to load connectors:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConnectors();
  }, [fetchConnectors]);

  // Apply filters
  useEffect(() => {
    let result = connectors;

    // Filter by Category
    if (selectedCategory !== 'All') {
      result = result.filter(c => c.category.toLowerCase() === selectedCategory.toLowerCase());
    }

    // Filter by Search Query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        c => c.name.toLowerCase().includes(query) || c.description.toLowerCase().includes(query)
      );
    }

    setFilteredConnectors(result);
  }, [connectors, selectedCategory, searchQuery]);

  const handleDisconnect = async (slug: string) => {
    try {
      const response = await fetch('/api/connectors/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, userId: '00000000-0000-0000-0000-000000000000' }),
      });

      if (response.ok) {
        await fetchConnectors();
      } else {
        console.error('Failed to disconnect connector');
      }
    } catch (e) {
      console.error('Error disconnecting connector:', e);
    }
  };

  const connectedCount = connectors.filter(c => c.isConnected).length;

  return (
    <div className="flex-1 flex flex-col bg-canvas overflow-y-auto h-full p-6 md:p-8 font-dmsans select-none animate-fadeIn">
      {/* Upper header title section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h2 className="font-lora font-normal text-2xl text-ink tracking-tight">
            MCP Tool Connectors
          </h2>
          <p className="text-xs text-muted font-normal leading-relaxed mt-1">
            Connect external APIs and service containers. Active tools can be discovered and executed autonomously by agents.
            <span className="ml-2 px-2 py-0.5 rounded-full bg-surface-cream-strong font-bold text-ink text-[10px]">
              {connectedCount} connected
            </span>
          </p>
        </div>

        <button
          onClick={fetchConnectors}
          disabled={loading}
          className="flex items-center gap-1.5 self-start px-3.5 py-1.5 border border-hairline bg-canvas rounded-lg text-xs font-semibold text-muted hover:text-ink hover:bg-surface-soft transition-colors cursor-pointer disabled:opacity-50 shadow-2xs"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between border-b border-hairline pb-4 mb-6">
        {/* Categories Tab navigation list */}
        <div className="flex flex-wrap items-center gap-1.5 w-full md:w-auto">
          {CATEGORIES.map((category) => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all duration-150 cursor-pointer ${
                selectedCategory === category
                  ? 'bg-surface-card text-ink border-hairline'
                  : 'bg-canvas text-muted border-hairline hover:bg-surface-soft hover:text-ink'
              }`}
            >
              {category}
            </button>
          ))}
        </div>

        {/* Text Search input */}
        <div className="relative w-full md:w-72">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-soft" />
          <input
            type="text"
            placeholder="Search connectors..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-canvas border border-hairline focus:border-primary focus:ring-2 focus:ring-primary/15 rounded-lg pl-9 pr-3.5 py-2 text-sm text-ink placeholder-muted-soft outline-none transition-all cursor-pointer focus:cursor-text"
          />
        </div>
      </div>

      {/* Main Grid View */}
      {loading ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-2.5">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
          <p className="text-xs text-muted font-medium">Loading MCP registry...</p>
        </div>
      ) : filteredConnectors.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center border border-dashed border-hairline bg-canvas/50 rounded-2xl p-8 text-center animate-fadeIn">
          <Plug className="w-8 h-8 text-muted-soft mb-2" />
          <h3 className="font-lora font-normal text-sm text-ink">No connectors found</h3>
          <p className="text-xs text-muted mt-1 max-w-sm leading-relaxed">
            Try adjusting your search filters or make sure your server configuration keys are set up.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 animate-slideUp">
          {filteredConnectors.map((conn) => (
            <ConnectorCard
              key={conn.slug}
              connector={conn}
              onConnectClick={() => {
                setSelectedConnector(conn);
                setIsModalOpen(true);
              }}
              onDisconnectClick={() => handleDisconnect(conn.slug)}
            />
          ))}
        </div>
      )}

      {/* Info notice about custom servers */}
      <div className="mt-8 p-4 bg-surface-soft/60 border border-hairline/80 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <Plug className="w-5 h-5 text-primary shrink-0 mt-0.5" />
          <div>
            <h5 className="text-xs font-bold text-ink">Self-hosted MCP SSE Server?</h5>
            <p className="text-[11px] text-muted leading-relaxed mt-0.5 max-w-2xl">
              You can connect any custom microservice compliant with the Model Context Protocol (MCP).
              Click connect on any integration, supply your server's endpoint address, and supply necessary auth secrets.
            </p>
          </div>
        </div>
        <a
          href="https://modelcontextprotocol.io"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs font-bold text-primary hover:underline flex items-center gap-1 shrink-0 cursor-pointer"
        >
          <span>Learn MCP Specification</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </a>
      </div>

      {/* Credentials Modal */}
      <ConnectModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedConnector(null);
        }}
        connector={selectedConnector}
        onConnectSuccess={fetchConnectors}
      />
    </div>
  );
}
