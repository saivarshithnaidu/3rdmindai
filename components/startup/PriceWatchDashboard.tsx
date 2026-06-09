'use client';

import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  Tag, 
  TrendingDown, 
  Play, 
  Pause, 
  HelpCircle,
  BellRing,
  RefreshCw,
  SlidersHorizontal,
  DollarSign
} from 'lucide-react';
import { PriceWatch, PriceHistory, StreamEventType } from '../../types';
import PriceWatchCard from './PriceWatchCard';
import AddWatchModal from './AddWatchModal';
import PriceHistoryChart from './PriceHistoryChart';
import LiveFeed from '../stream/LiveFeed';

interface PriceWatchDashboardProps {
  projectId: string | null;
}

export default function PriceWatchDashboard({ projectId }: PriceWatchDashboardProps) {
  const [watches, setWatches] = useState<PriceWatch[]>([]);
  const [histories, setHistories] = useState<Record<string, PriceHistory[]>>({});
  
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'watching' | 'triggered' | 'paused'>('all');
  
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedWatchForChart, setSelectedWatchForChart] = useState<PriceWatch | null>(null);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchWatches();
  }, [projectId]);

  const fetchWatches = async () => {
    setLoading(true);
    setError(null);
    try {
      const url = projectId 
        ? `/api/price-watch/list?projectId=${projectId}` 
        : '/api/price-watch/list';
      
      const res = await fetch(url);
      const data = await res.json();
      
      if (data.success) {
        const fetchedWatches: PriceWatch[] = data.watches || [];
        setWatches(fetchedWatches);
        
        // Fetch histories for all watches to construct sparklines
        fetchedWatches.forEach(async (watch) => {
          try {
            const hRes = await fetch(`/api/price-watch/history?watchId=${watch.id}`);
            const hData = await hRes.json();
            if (hData.success) {
              setHistories(prev => ({
                ...prev,
                [watch.id]: hData.history || []
              }));
            }
          } catch (hErr) {
            console.error(`Error loading history for watch ${watch.id}:`, hErr);
          }
        });
      } else {
        setError(data.error || 'Failed to load watches.');
      }
    } catch (e: any) {
      setError(e.message || 'An error occurred fetching watches.');
    } finally {
      setLoading(false);
    }
  };

  // Mutations
  const handleCreateWatch = async (watchData: any) => {
    const res = await fetch('/api/price-watch/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...watchData,
        projectId
      })
    });
    const data = await res.json();
    if (!data.success) {
      throw new Error(data.error || 'Failed to create price watch.');
    }
    
    // Refetch to include new watch
    await fetchWatches();
  };

  const handleRefreshWatch = async (id: string) => {
    const res = await fetch('/api/price-watch/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ watchId: id })
    });
    const data = await res.json();
    if (data.success) {
      // Update watch item locally
      setWatches(prev => prev.map(w => w.id === id ? data.watch : w));
      
      // Refetch history for sparkline
      const hRes = await fetch(`/api/price-watch/history?watchId=${id}`);
      const hData = await hRes.json();
      if (hData.success) {
        setHistories(prev => ({
          ...prev,
          [id]: hData.history || []
        }));
      }
    } else {
      alert(data.error || 'Failed to refresh price.');
    }
  };

  const handlePauseWatch = async (id: string) => {
    const res = await fetch('/api/price-watch/pause', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ watchId: id })
    });
    const data = await res.json();
    if (data.success) {
      setWatches(prev => prev.map(w => w.id === id ? data.watch : w));
    }
  };

  const handleResumeWatch = async (id: string) => {
    const res = await fetch('/api/price-watch/resume', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ watchId: id })
    });
    const data = await res.json();
    if (data.success) {
      setWatches(prev => prev.map(w => w.id === id ? data.watch : w));
    }
  };

  const handleDeleteWatch = async (id: string) => {
    const res = await fetch('/api/price-watch/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ watchId: id })
    });
    const data = await res.json();
    if (data.success) {
      setWatches(prev => prev.filter(w => w.id !== id));
      setHistories(prev => {
        const copy = { ...prev };
        delete copy[id];
        return copy;
      });
    }
  };

  const handleTestAlert = async (id: string) => {
    const res = await fetch('/api/price-watch/test-alert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ watchId: id })
    });
    const data = await res.json();
    if (!data.success) {
      throw new Error(data.error || 'Test alerts failed.');
    }
  };

  const handleViewHistory = (watch: PriceWatch) => {
    setSelectedWatchForChart(watch);
  };

  // Filter & Search Watches
  const filteredWatches = watches.filter(watch => {
    const matchesSearch = watch.product_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          watch.product_url.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || watch.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  // Calculate Metrics
  const totalWatches = watches.length;
  const activeWatches = watches.filter(w => w.status === 'watching').length;
  const triggeredWatches = watches.filter(w => w.status === 'triggered').length;
  
  // Calculate average discount on watches with original price info
  const watchesWithDiscounts = watches.filter(w => w.original_price && w.current_price && w.original_price > w.current_price);
  const avgDiscountPercent = watchesWithDiscounts.length > 0
    ? Math.round(
        watchesWithDiscounts.reduce((acc, w) => acc + ((w.original_price! - w.current_price!) / w.original_price!) * 100, 0) / 
        watchesWithDiscounts.length
      )
    : 0;

  return (
    <div className="space-y-6">
      {/* Upper Metrics Card Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1 */}
        <div className="relative bg-white border border-[#E5E0DA] p-5 rounded-2xl flex flex-col justify-between shadow-xs overflow-hidden group transition-all duration-300 hover:shadow-sm">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity duration-300">
            <Tag className="w-16 h-16 text-[#191919]" />
          </div>
          <span className="text-[10px] text-[#85827D] uppercase font-black tracking-wider">Total Tracked Products</span>
          <span className="text-3xl font-black text-[#191919] mt-2 tracking-tight">{totalWatches}</span>
          <span className="text-[10px] text-[#5E5B56] mt-1">Across all ecommerce platforms</span>
        </div>

        {/* Metric 2 */}
        <div className="relative bg-white border border-[#E5E0DA] p-5 rounded-2xl flex flex-col justify-between shadow-xs overflow-hidden group transition-all duration-300 hover:shadow-sm">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity duration-300">
            <RefreshCw className="w-16 h-16 text-[#D97757]" />
          </div>
          <span className="text-[10px] text-[#85827D] uppercase font-black tracking-wider">Active Monitoring</span>
          <span className="text-3xl font-black text-[#D97757] mt-2 tracking-tight">{activeWatches}</span>
          <span className="text-[10px] text-[#5E5B56] mt-1">Watching hourly/interval drops</span>
        </div>

        {/* Metric 3 */}
        <div className="relative bg-white border border-[#E5E0DA] p-5 rounded-2xl flex flex-col justify-between shadow-xs overflow-hidden group transition-all duration-300 hover:shadow-sm">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity duration-300">
            <BellRing className="w-16 h-16 text-amber-500" />
          </div>
          <span className="text-[10px] text-[#85827D] uppercase font-black tracking-wider">Target Prices Hit</span>
          <span className="text-3xl font-black text-amber-600 mt-2 tracking-tight">{triggeredWatches}</span>
          <span className="text-[10px] text-[#5E5B56] mt-1">Alerts dispatched via SMS/WhatsApp/Email</span>
        </div>

        {/* Metric 4 */}
        <div className="relative bg-white border border-[#E5E0DA] p-5 rounded-2xl flex flex-col justify-between shadow-xs overflow-hidden group transition-all duration-300 hover:shadow-sm">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity duration-300">
            <TrendingDown className="w-16 h-16 text-emerald-500" />
          </div>
          <span className="text-[10px] text-[#85827D] uppercase font-black tracking-wider">Average Drop Drops</span>
          <span className="text-3xl font-black text-emerald-600 mt-2 tracking-tight">{avgDiscountPercent}%</span>
          <span className="text-[10px] text-[#5E5B56] mt-1">Average difference from original MSRP</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white border border-[#E5E0DA] p-4 rounded-2xl shadow-xs">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#85827D]" />
          <input
            type="text"
            placeholder="Search product names, URLs or platforms..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#FBF9F6] border border-[#E5E0DA] rounded-xl pl-10 pr-4 py-2.5 text-xs text-[#191919] focus:outline-none focus:border-[#D97757] transition-all font-dmsans placeholder-[#85827D]"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <SlidersHorizontal className="w-3.5 h-3.5 text-[#5E5B56] mr-1 flex-shrink-0" />
          {[
            { id: 'all', label: 'All Watches' },
            { id: 'watching', label: 'Watching' },
            { id: 'triggered', label: 'Target Met' },
            { id: 'paused', label: 'Paused' }
          ].map((pill) => (
            <button
              key={pill.id}
              onClick={() => setStatusFilter(pill.id as any)}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-extrabold uppercase tracking-wider transition-all duration-200 border ${
                statusFilter === pill.id
                  ? 'bg-[#191919] border-[#191919] text-white shadow-xs'
                  : 'bg-white border-[#E5E0DA] text-[#5E5B56] hover:text-[#191919] hover:bg-[#FBF9F6]'
              }`}
            >
              {pill.label}
            </button>
          ))}
        </div>

        {/* Action Button */}
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="px-4 py-2.5 rounded-xl bg-[#D97757] hover:bg-[#C46747] text-white font-extrabold text-xs transition-all flex items-center justify-center gap-1.5 shadow-[0_2px_8px_rgba(217,119,87,0.2)] hover:shadow-[0_4px_16px_rgba(217,119,87,0.3)] cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Track Product
        </button>
      </div>

      {/* Dashboard Main Grid */}
      {loading ? (
        <div className="py-24 flex flex-col items-center justify-center gap-3 bg-white border border-[#E5E0DA] rounded-2xl shadow-xs">
          <RefreshCw className="w-7 h-7 text-[#D97757] animate-spin" />
          <span className="text-xs text-[#5E5B56] font-bold uppercase tracking-widest">Running price check updates...</span>
        </div>
      ) : error ? (
        <div className="py-12 text-center text-rose-600 bg-rose-50 border border-rose-100 rounded-2xl text-xs font-semibold">
          {error}
        </div>
      ) : filteredWatches.length === 0 ? (
        <div className="py-20 text-center bg-white border border-dashed border-[#E5E0DA] rounded-2xl flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-[#FBF9F6] border border-[#E5E0DA] flex items-center justify-center text-[#85827D]">
            <HelpCircle className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-[#191919] mb-1">No tracked products found</h3>
            <p className="text-xs text-[#5E5B56]">Try adjusting filters, modifying search, or create a new price watch target.</p>
          </div>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="px-4 py-2.5 rounded-xl bg-[#D97757]/10 border border-[#D97757]/20 hover:bg-[#D97757] hover:text-white text-[#D97757] font-bold text-xs transition-all cursor-pointer"
          >
            Create First Price Watch
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredWatches.map((watch) => (
            <PriceWatchCard
              key={watch.id}
              watch={watch}
              history={histories[watch.id] || []}
              onRefresh={handleRefreshWatch}
              onPause={handlePauseWatch}
              onResume={handleResumeWatch}
              onDelete={handleDeleteWatch}
              onTestAlert={handleTestAlert}
              onViewHistory={handleViewHistory}
            />
          ))}
        </div>
      )}

      {/* Live Feed for Price Scrapes */}
      {projectId && (
        <div className="mt-8 border-t border-[#E5E0DA] pt-6">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#85827D] mb-3">Live Scrape & Alert Monitor</h3>
          <LiveFeed 
            projectId={projectId} 
            filterTypes={[
              StreamEventType.PRICE_CHECKING, 
              StreamEventType.PRICE_FOUND, 
              StreamEventType.PRICE_TARGET_HIT, 
              StreamEventType.PRICE_ALERT_SENT
            ]}
            compact={true}
            maxHeight="250px"
          />
        </div>
      )}

      {/* Add Watch Modal */}
      <AddWatchModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSubmit={handleCreateWatch}
        projectId={projectId}
      />

      {/* Detailed History Chart Modal */}
      <PriceHistoryChart
        watch={selectedWatchForChart}
        isOpen={selectedWatchForChart !== null}
        onClose={() => setSelectedWatchForChart(null)}
      />
    </div>
  );
}
