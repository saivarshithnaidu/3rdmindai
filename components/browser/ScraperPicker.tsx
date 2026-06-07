import React, { useState } from 'react';
import { SCRAPER_CONFIGS } from '../../lib/scrapers.registry';
import { X, Search, Sliders, Play, Loader2, Globe, MapPin, Rocket, Building, Compass } from 'lucide-react';
import { ScraperConfig } from '../../types';

interface ScraperPickerProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  onScrapeStarted: (canvasId: string) => void;
}

export default function ScraperPicker({
  isOpen,
  onClose,
  projectId,
  onScrapeStarted
}: ScraperPickerProps) {
  const [selectedScraper, setSelectedScraper] = useState<ScraperConfig | null>(null);
  const [query, setQuery] = useState('');
  const [maxResults, setMaxResults] = useState(20);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  // Map configuration icon names to Lucide icons
  const getIcon = (iconName: string) => {
    switch (iconName) {
      case 'ti-map-pin':
        return <MapPin className="w-5 h-5 text-red-500" />;
      case 'ti-brand-google':
        return <Search className="w-5 h-5 text-blue-500" />;
      case 'ti-rocket':
        return <Rocket className="w-5 h-5 text-amber-500" />;
      case 'ti-brand-x':
        return (
          <svg viewBox="0 0 24 24" className="w-5 h-5 text-neutral-800" fill="currentColor">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
          </svg>
        );
      case 'ti-building-skyscraper':
        return <Building className="w-5 h-5 text-orange-500" />;
      default:
        return <Compass className="w-5 h-5 text-emerald-500" />;
    }
  };

  const handleStartScraping = async () => {
    if (!selectedScraper || !query.trim()) return;

    try {
      setLoading(true);
      setErrorMsg(null);

      const res = await fetch('/api/browser/scrape', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          projectId,
          scraperType: selectedScraper.id,
          query: query.trim(),
          maxResults
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to start scraping task.');
      }

      const data = await res.json();
      if (data.canvasId) {
        onScrapeStarted(data.canvasId);
        onClose();
        // Reset states
        setSelectedScraper(null);
        setQuery('');
        setMaxResults(20);
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Failed to initiate browser agent');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#191919]/40 backdrop-blur-xs p-4 animate-fadeIn font-dmsans select-none">
      <div className="bg-[#FDFBF7] border border-[#E5E0DA] rounded-2xl w-full max-w-2xl shadow-xl flex flex-col overflow-hidden max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-[#E5E0DA] flex items-center justify-between bg-[#F4F0EB]">
          <div>
            <h3 className="text-sm font-bold text-[#191919] font-lora">Browser Agent</h3>
            <p className="text-[10px] text-[#85827D] font-medium mt-0.5">Open a real browser to find structured data</p>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-[#E9E3DB] rounded-lg text-[#85827D] hover:text-[#191919] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {errorMsg && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-xs flex items-center gap-2">
              <span className="font-semibold">Error:</span> {errorMsg}
            </div>
          )}

          {!selectedScraper ? (
            /* Card selection grid */
            <div className="space-y-4">
              <span className="text-[10px] font-bold text-[#85827D] uppercase tracking-wider block">Select Browser Scraper</span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {SCRAPER_CONFIGS.map((config) => (
                  <button
                    key={config.id}
                    onClick={() => {
                      setSelectedScraper(config);
                      setQuery('');
                      setMaxResults(config.id === 'generic' ? 1 : config.maxResults || 20);
                    }}
                    className="flex items-start gap-3.5 p-4 bg-white border border-[#E5E0DA] rounded-xl hover:bg-[#FDFBF7] hover:border-[#85827D]/45 transition-all text-left shadow-2xs hover:shadow-xs cursor-pointer"
                  >
                    <div className="p-2 bg-[#F4F0EB] rounded-lg shrink-0 mt-0.5">
                      {getIcon(config.icon)}
                    </div>
                    <div className="min-w-0">
                      <span className="font-bold text-xs text-[#191919]">{config.name}</span>
                      <p className="text-[10px] text-[#85827D] mt-1 leading-normal font-medium">{config.description}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            /* Scraper details configuration form */
            <div className="space-y-5 animate-fadeIn">
              {/* Back to selector */}
              <button
                onClick={() => setSelectedScraper(null)}
                className="text-[10px] font-bold text-blue-600 hover:underline cursor-pointer flex items-center gap-1"
              >
                &larr; Choose a different scraper
              </button>

              <div className="flex items-center gap-3 p-3 bg-[#F4F0EB] border border-[#E5E0DA] rounded-xl">
                <div className="p-2 bg-white rounded-lg">
                  {getIcon(selectedScraper.icon)}
                </div>
                <div>
                  <span className="font-bold text-xs text-[#191919]">{selectedScraper.name} Scraper</span>
                  <p className="text-[9px] text-[#85827D] font-medium">{selectedScraper.description}</p>
                </div>
              </div>

              {/* Input details */}
              <div className="space-y-4 pt-1">
                <div className="space-y-1.5">
                  <label htmlFor="scraper-query" className="text-[10px] font-bold text-[#85827D] uppercase tracking-wider block">
                    {selectedScraper.id === 'generic' ? 'Target Website URL' : 'Search Query'}
                  </label>
                  <div className="relative flex items-center">
                    <input
                      id="scraper-query"
                      type="text"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder={selectedScraper.queryPlaceholder}
                      className="w-full bg-white border border-[#E5E0DA] rounded-xl py-2 px-3.5 pl-10 text-xs text-[#191919] focus:outline-hidden focus:border-[#85827D]"
                    />
                    <Search className="w-3.5 h-3.5 text-[#85827D] absolute left-3.5 pointer-events-none" />
                  </div>
                </div>

                {selectedScraper.id !== 'generic' && (
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <label htmlFor="scraper-results" className="text-[10px] font-bold text-[#85827D] uppercase tracking-wider flex items-center gap-1">
                        <Sliders className="w-3 h-3" />
                        <span>Maximum Results</span>
                      </label>
                      <span className="text-xs font-bold text-[#191919] bg-[#EBE5DC] px-2 py-0.5 rounded-md">
                        {maxResults}
                      </span>
                    </div>
                    <input
                      id="scraper-results"
                      type="range"
                      min="10"
                      max="50"
                      step="5"
                      value={maxResults}
                      onChange={(e) => setMaxResults(parseInt(e.target.value, 10))}
                      className="w-full h-1.5 bg-[#EBE5DC] rounded-lg appearance-none cursor-pointer accent-[#191919]"
                    />
                    <div className="flex justify-between text-[9px] text-[#85827D] font-bold">
                      <span>10</span>
                      <span>30</span>
                      <span>50</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-[#E5E0DA] bg-[#F4F0EB] flex justify-end gap-2 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-[#85827D] hover:bg-[#E9E3DB] border border-[#E5E0DA] rounded-lg transition-colors cursor-pointer"
          >
            Close
          </button>
          {selectedScraper && (
            <button
              onClick={handleStartScraping}
              disabled={loading || !query.trim()}
              className="px-4 py-2 text-xs font-bold text-white bg-[#191919] hover:bg-neutral-800 disabled:opacity-50 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
            >
              {loading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Starting...</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Start Scraping</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
