'use client';

import React, { useState, useEffect } from 'react';
import { X, Loader2, Link2, Key, Info, ExternalLink, ShieldCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const CONNECTOR_SLUG_TO_PROVIDER: Record<string, string> = {
  'google-drive': 'google',
  'gmail': 'google',
  'google-calendar': 'google',
  'slack': 'slack',
  'github': 'github',
  'notion': 'notion',
  'linear': 'linear',
  'jira': 'atlassian',
  'outlook': 'azuread',
  'onedrive': 'azuread',
  'hubspot': 'hubspot',
  'salesforce': 'salesforce',
  'dropbox': 'dropbox',
  'discord': 'discord',
  'asana': 'asana'
};

interface ConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  connector: {
    slug: string;
    name: string;
    authType: 'api_key' | 'oauth' | 'none';
    icon: string;
    docsUrl: string;
    scopes?: string[];
    keyLabel?: string;
    keyPlaceholder?: string;
    keyDocsUrl?: string;
    serverUrl: string;
  } | null;
  onConnectSuccess: () => void;
}

export default function ConnectModal({ isOpen, onClose, connector, onConnectSuccess }: ConnectModalProps) {
  const [apiKey, setApiKey] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successCount, setSuccessCount] = useState<number | null>(null);

  useEffect(() => {
    if (connector) {
      setApiKey('');
      setError(null);
      setSuccessCount(null);
    }
  }, [connector]);

  if (!isOpen || !connector) return null;

  const handleConnectApiKey = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/connectors/connect/apikey', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: connector.slug,
          apiKey: apiKey.trim(),
          userId: '00000000-0000-0000-0000-000000000000'
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Validation failed');
      }

      setSuccessCount(data.toolCount || 0);
      setTimeout(() => {
        onConnectSuccess();
        onClose();
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleEnableNoAuth = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/connectors/connect/apikey', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: connector.slug,
          userId: '00000000-0000-0000-0000-000000000000'
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to enable');
      }

      setSuccessCount(data.toolCount || 0);
      setTimeout(() => {
        onConnectSuccess();
        onClose();
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleOAuthRedirect = () => {
    const provider = CONNECTOR_SLUG_TO_PROVIDER[connector.slug] || connector.slug;
    window.location.href = `/api/connectors/connect/oauth?provider=${provider}`;
  };

  const renderIcon = () => {
    if (connector.icon.startsWith('ti-')) {
      return <i className={`ti ${connector.icon} text-lg text-primary`} />;
    }
    return <Link2 className="w-4 h-4 text-primary" />;
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
          className="fixed inset-0 bg-[#141413]/30 backdrop-blur-xs"
        />

        {/* Modal Content */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ type: 'spring', duration: 0.35 }}
          className="relative w-full max-w-md bg-canvas border border-hairline rounded-2xl shadow-xl overflow-hidden font-dmsans z-10"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-hairline bg-surface-soft">
            <div className="flex items-center gap-2">
              {renderIcon()}
              <h3 className="font-lora font-normal text-base text-ink">
                Connect {connector.name}
              </h3>
            </div>
            <button
              onClick={onClose}
              className="p-1 hover:bg-surface-cream-strong rounded-lg text-muted hover:text-ink transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-5 space-y-4">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-xs font-semibold">
                {error}
              </div>
            )}

            {successCount !== null && (
              <div className="p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-xs font-semibold flex items-center gap-2 animate-gentlePulse">
                <ShieldCheck className="w-4 h-4 text-green-600 shrink-0" />
                <span>Connected successfully! {successCount} tools available.</span>
              </div>
            )}

            {/* API Key Connection Form */}
            {connector.authType === 'api_key' && (
              <form onSubmit={handleConnectApiKey} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-muted flex items-center gap-1">
                    <Key className="w-3.5 h-3.5 text-muted-soft" />
                    <span>{connector.keyLabel || 'API Key'}</span>
                  </label>
                  <input
                    type="password"
                    required
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder={connector.keyPlaceholder || 'Enter API token'}
                    className="w-full bg-canvas border border-hairline focus:border-primary focus:ring-2 focus:ring-primary/15 rounded-lg px-3 py-2 text-sm text-ink outline-none transition-all"
                  />
                  {connector.keyDocsUrl && (
                    <p className="text-[10px] text-muted-soft flex items-start gap-1">
                      <Info className="w-3.5 h-3.5 shrink-0 mt-0.5 text-primary" />
                      <span>
                        Get your key at{' '}
                        <a
                          href={connector.keyDocsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline font-bold inline-flex items-center gap-0.5"
                        >
                          <span>{connector.name} Dashboard</span>
                          <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      </span>
                    </p>
                  )}
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-hairline">
                  <button
                    type="button"
                    onClick={onClose}
                    disabled={isLoading}
                    className="px-4 py-2 text-xs font-semibold text-muted hover:text-ink hover:bg-surface-soft rounded-lg border border-hairline bg-canvas transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isLoading || successCount !== null}
                    className="px-4 py-2 text-xs font-semibold text-on-primary bg-primary hover:bg-primary-active rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 shadow-sm"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Validating...</span>
                      </>
                    ) : (
                      <span>Validate & Connect</span>
                    )}
                  </button>
                </div>
              </form>
            )}

            {/* OAuth Connection Block */}
            {connector.authType === 'oauth' && (
              <div className="space-y-4">
                <div className="text-xs text-body leading-relaxed space-y-2">
                  <p className="font-semibold text-ink">Access Permissions Requested:</p>
                  <ul className="list-disc pl-4 space-y-1 text-muted-soft">
                    {connector.scopes && connector.scopes.length > 0 ? (
                      connector.scopes.map((scope) => (
                        <li key={scope} className="truncate text-[11px]" title={scope}>
                          {scope.replace('https://www.googleapis.com/auth/', '')}
                        </li>
                      ))
                    ) : (
                      <li>Read/Write user pages and data</li>
                    )}
                    <li>Background synchronization</li>
                  </ul>
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-hairline">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 text-xs font-semibold text-muted hover:text-ink hover:bg-surface-soft rounded-lg border border-hairline bg-canvas transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleOAuthRedirect}
                    disabled={isLoading}
                    className="px-4 py-2 text-xs font-semibold text-on-primary bg-primary hover:bg-primary-active rounded-lg transition-colors cursor-pointer shadow-sm"
                  >
                    Connect with {connector.name}
                  </button>
                </div>
              </div>
            )}

            {/* No-Auth / None Connection Block */}
            {connector.authType === 'none' && (
              <div className="space-y-4">
                <p className="text-xs text-body leading-relaxed">
                  This connector uses a public/unauthenticated endpoint. It is instantly available without keys or credentials.
                </p>

                <div className="flex justify-end gap-2 pt-3 border-t border-hairline">
                  <button
                    type="button"
                    onClick={onClose}
                    disabled={isLoading}
                    className="px-4 py-2 text-xs font-semibold text-muted hover:text-ink hover:bg-surface-soft rounded-lg border border-hairline bg-canvas transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleEnableNoAuth}
                    disabled={isLoading || successCount !== null}
                    className="px-4 py-2 text-xs font-semibold text-on-primary bg-primary hover:bg-primary-active rounded-lg transition-colors cursor-pointer shadow-sm flex items-center gap-1.5"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Enabling...</span>
                      </>
                    ) : (
                      <span>Enable Connector</span>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
