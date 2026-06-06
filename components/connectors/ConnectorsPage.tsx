'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Search, Loader2, ArrowRight, Plug, RefreshCw } from 'lucide-react';
import ConnectorCard from './ConnectorCard';
import ConnectModal from './ConnectModal';

interface Connector {
  id: string;
  name: string;
  category: string;
  description: string;
  authType: 'api_key' | 'oauth' | 'none';
  serverUrl: string;
  isActive: boolean;
  docsUrl?: string;
  icon?: string;
}

const CATEGORIES = ['All', 'Productivity', 'Search', 'Communication', 'Developer', 'Finance', 'Storage'];

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
      const response = await fetch('/api/connectors/list');
      if (response.ok) {
        const data = await response.json();
        setConnectors(data);
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

  const handleConnect = async (params: {
    name: string;
    serverUrl: string;
    apiKey?: string;
    oauthToken?: string;
  }) => {
    const response = await fetch('/api/connectors/connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      const errData = await response.json();
      throw new Error(errData.error || 'Failed to establish connection to MCP server');
    }

    // Refresh connectors list
    await fetchConnectors();
  };

  const handleDisconnect = async (id: string) => {
    try {
      const response = await fetch('/api/connectors/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
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

  return (
    <div className="flex-1 flex flex-col bg-[#FBF9F6] overflow-y-auto h-full p-6 md:p-8 font-dmsans select-none animate-fadeIn">
      {/* Upper header title section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h2 className="font-lora font-bold text-2xl text-[#191919] tracking-tight">
            MCP Tool Connectors
          </h2>
          <p className="text-xs text-[#5E5B56] font-normal leading-relaxed mt-1">
            Connect external APIs and service containers. Active tools can be discovered and executed autonomously by agents.
          </p>
        </div>

        <button
          onClick={fetchConnectors}
          disabled={loading}
          className="flex items-center gap-1.5 self-start px-3.5 py-1.5 border border-[#E5E0DA] bg-white rounded-lg text-xs font-semibold text-[#5E5B56] hover:text-[#191919] hover:bg-[#F4F0EB] transition-colors cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between border-b border-[#E5E0DA] pb-4 mb-6">
        {/* Categories Tab navigation list */}
        <div className="flex flex-wrap items-center gap-1.5 w-full md:w-auto">
          {CATEGORIES.map((category) => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all duration-150 cursor-pointer ${
                selectedCategory === category
                  ? 'bg-[#191919] text-white border-transparent'
                  : 'bg-white text-[#5E5B56] border-[#E5E0DA] hover:bg-[#F4F0EB]'
              }`}
            >
              {category}
            </button>
          ))}
        </div>

        {/* Text Search input */}
        <div className="relative w-full md:w-72">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-[#85827D]" />
          <input
            type="text"
            placeholder="Search connectors..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white border border-[#E5E0DA] focus:border-[#D97757] focus:shadow-2xs rounded-lg pl-9 pr-3.5 py-2 text-sm text-[#191919] placeholder-[#85827D] outline-none transition-all cursor-pointer focus:cursor-text"
          />
        </div>
      </div>

      {/* Main Grid View */}
      {loading ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-2.5">
          <Loader2 className="w-6 h-6 animate-spin text-[#D97757]" />
          <p className="text-xs text-[#5E5B56] font-medium">Loading MCP registry...</p>
        </div>
      ) : filteredConnectors.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center border border-dashed border-[#E5E0DA] bg-white/50 rounded-2xl p-8 text-center">
          <Plug className="w-8 h-8 text-[#85827D] mb-2" />
          <h3 className="font-lora font-bold text-sm text-[#191919]">No connectors found</h3>
          <p className="text-xs text-[#5E5B56] mt-1 max-w-sm leading-relaxed">
            Try adjusting your search filters or make sure your server configuration keys are set up.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredConnectors.map((conn) => (
            <ConnectorCard
              key={conn.name}
              connector={conn}
              onConnectClick={() => {
                setSelectedConnector(conn);
                setIsModalOpen(true);
              }}
              onDisconnectClick={() => handleDisconnect(conn.id)}
            />
          ))}
        </div>
      )}

      {/* Info notice about custom servers */}
      <div className="mt-8 p-4 bg-[#F4F0EB]/60 border border-[#E5E0DA]/80 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <Plug className="w-5 h-5 text-[#D97757] shrink-0 mt-0.5" />
          <div>
            <h5 className="text-xs font-bold text-[#191919]">Self-hosted MCP SSE Server?</h5>
            <p className="text-[11px] text-[#5E5B56] leading-relaxed mt-0.5 max-w-2xl">
              You can connect any custom microservice compliant with the Model Context Protocol (MCP).
              Click connect on any integration, supply your server's endpoint address, and supply necessary auth secrets.
            </p>
          </div>
        </div>
        <a
          href="https://modelcontextprotocol.io"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs font-bold text-[#D97757] hover:underline flex items-center gap-1 shrink-0 cursor-pointer"
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
        onConnect={handleConnect}
      />
    </div>
  );
}
