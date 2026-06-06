'use client';

import React, { useState, useEffect } from 'react';
import { X, Loader2, Link2, Key, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface ConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  connector: {
    id: string;
    name: string;
    authType: 'api_key' | 'oauth' | 'none';
    serverUrl: string;
    isActive: boolean;
  } | null;
  onConnect: (params: {
    name: string;
    serverUrl: string;
    apiKey?: string;
    oauthToken?: string;
  }) => Promise<void>;
}

export default function ConnectModal({ isOpen, onClose, connector, onConnect }: ConnectModalProps) {
  const [serverUrl, setServerUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [oauthToken, setOauthToken] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (connector) {
      setServerUrl(connector.serverUrl || '');
      setApiKey('');
      setOauthToken('');
      setError(null);
    }
  }, [connector]);

  if (!isOpen || !connector) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      if (!serverUrl.trim()) {
        throw new Error('Server URL is required');
      }

      await onConnect({
        name: connector.name,
        serverUrl: serverUrl.trim(),
        apiKey: connector.authType === 'api_key' ? apiKey.trim() : undefined,
        oauthToken: connector.authType === 'oauth' ? oauthToken.trim() : undefined,
      });

      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-[#191919]/30 backdrop-blur-xs"
        />

        {/* Modal Content */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ type: 'spring', duration: 0.35 }}
          className="relative w-full max-w-md bg-[#FFFFFF] border border-[#E5E0DA] rounded-2xl shadow-xl overflow-hidden font-dmsans z-10"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-[#E5E0DA] bg-[#F4F0EB]">
            <div className="flex items-center gap-2">
              <Link2 className="w-4 h-4 text-[#D97757]" />
              <h3 className="font-lora font-bold text-base text-[#191919]">
                Connect {connector.name}
              </h3>
            </div>
            <button
              onClick={onClose}
              className="p-1 hover:bg-[#E9E3DB] rounded-lg text-[#5E5B56] hover:text-[#191919] transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-xs font-semibold">
                {error}
              </div>
            )}

            {/* Server URL */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-[#5E5B56]">
                MCP SERVER URL
              </label>
              <input
                type="url"
                required
                value={serverUrl}
                onChange={(e) => setServerUrl(e.target.value)}
                placeholder="e.g. https://mcp.server/sse"
                className="w-full bg-[#FBF9F6] border border-[#E5E0DA] focus:border-[#D97757] rounded-lg px-3 py-2 text-sm text-[#191919] outline-none transition-colors"
              />
              <p className="text-[10px] text-[#85827D] flex items-start gap-1">
                <Info className="w-3.5 h-3.5 shrink-0 mt-0.5 text-[#D97757]" />
                <span>The URL of your running MCP server exposing tools. Default endpoint is used by fallback mock simulations.</span>
              </p>
            </div>

            {/* API Key */}
            {connector.authType === 'api_key' && (
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-[#5E5B56] flex items-center gap-1">
                  <Key className="w-3.5 h-3.5 text-[#85827D]" />
                  <span>API KEY</span>
                </label>
                <input
                  type="password"
                  required
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Enter your API token"
                  className="w-full bg-[#FBF9F6] border border-[#E5E0DA] focus:border-[#D97757] rounded-lg px-3 py-2 text-sm text-[#191919] outline-none transition-colors"
                />
              </div>
            )}

            {/* OAuth Token */}
            {connector.authType === 'oauth' && (
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-[#5E5B56] flex items-center gap-1">
                  <Key className="w-3.5 h-3.5 text-[#85827D]" />
                  <span>OAUTH TOKEN</span>
                </label>
                <input
                  type="password"
                  required
                  value={oauthToken}
                  onChange={(e) => setOauthToken(e.target.value)}
                  placeholder="Enter OAuth access token"
                  className="w-full bg-[#FBF9F6] border border-[#E5E0DA] focus:border-[#D97757] rounded-lg px-3 py-2 text-sm text-[#191919] outline-none transition-colors"
                />
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-3 border-t border-[#E5E0DA]">
              <button
                type="button"
                onClick={onClose}
                disabled={isLoading}
                className="px-4 py-2 text-xs font-semibold text-[#5E5B56] hover:text-[#191919] hover:bg-[#F4F0EB] rounded-lg border border-[#E5E0DA] bg-white transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="px-4 py-2 text-xs font-semibold text-white bg-[#D97757] hover:bg-[#C86646] rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Connecting...</span>
                  </>
                ) : (
                  <span>Connect Server</span>
                )}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
