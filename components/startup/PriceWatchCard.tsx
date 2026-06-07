'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Play, 
  Pause, 
  Trash2, 
  RefreshCw, 
  TrendingDown, 
  AlertTriangle, 
  ExternalLink, 
  Bell, 
  LineChart,
  ShoppingBag,
  Target,
  ArrowDown
} from 'lucide-react';
import { PriceWatch, PriceHistory } from '../../types';

interface PriceWatchCardProps {
  watch: PriceWatch;
  history: PriceHistory[];
  onRefresh: (id: string) => Promise<void>;
  onPause: (id: string) => Promise<void>;
  onResume: (id: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onTestAlert: (id: string) => Promise<void>;
  onViewHistory: (watch: PriceWatch) => void;
}

export default function PriceWatchCard({
  watch,
  history = [],
  onRefresh,
  onPause,
  onResume,
  onDelete,
  onTestAlert,
  onViewHistory
}: PriceWatchCardProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isPausing, setIsPausing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; msg: string } | null>(null);

  const discount = watch.original_price && watch.current_price
    ? Math.round(((watch.original_price - watch.current_price) / watch.original_price) * 100)
    : 0;

  // Render SVG Sparkline
  const renderSparkline = () => {
    if (history.length < 2) {
      return (
        <svg width="120" height="36" viewBox="0 0 120 36" className="text-[#85827D] opacity-40">
          <line x1="0" y1="18" x2="120" y2="18" stroke="currentColor" strokeWidth="2" strokeDasharray="3,3" />
        </svg>
      );
    }

    const width = 120;
    const height = 36;
    const padding = 3;
    
    const prices = history.map(h => Number(h.price));
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const priceRange = maxPrice - minPrice || 1;

    const points = prices.map((price, idx) => {
      const x = (idx / (prices.length - 1)) * width;
      const y = height - padding - ((price - minPrice) / priceRange) * (height - padding * 2);
      return { x, y };
    });

    const pathD = `M ${points[0].x} ${points[0].y} ` + points.slice(1).map(p => `L ${p.x} ${p.y}`).join(' ');
    const areaD = `${pathD} L ${points[points.length - 1].x} ${height} L ${points[0].x} ${height} Z`;

    const isPriceDown = prices[prices.length - 1] < prices[0];
    const strokeColor = isPriceDown ? '#10B981' : '#D97757'; // Green if trending down, Terracotta if up/same
    const fillGradientId = `grad-${watch.id}`;

    return (
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
        <defs>
          <linearGradient id={fillGradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={strokeColor} stopOpacity="0.15" />
            <stop offset="100%" stopColor={strokeColor} stopOpacity="0.00" />
          </linearGradient>
        </defs>
        <path d={areaD} fill={`url(#${fillGradientId})`} />
        <path d={pathD} fill="none" stroke={strokeColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={points[points.length - 1].x} cy={points[points.length - 1].y} r="3" fill={strokeColor} />
      </svg>
    );
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await onRefresh(watch.id);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleToggleStatus = async () => {
    setIsPausing(true);
    try {
      if (watch.status === 'paused') {
        await onResume(watch.id);
      } else {
        await onPause(watch.id);
      }
    } finally {
      setIsPausing(false);
    }
  };

  const handleDelete = async () => {
    if (confirm(`Are you sure you want to stop watching ${watch.product_name}?`)) {
      setIsDeleting(true);
      try {
        await onDelete(watch.id);
      } finally {
        setIsDeleting(false);
      }
    }
  };

  const handleTestAlert = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      await onTestAlert(watch.id);
      setTestResult({ success: true, msg: 'Test alert sent successfully!' });
      setTimeout(() => setTestResult(null), 3000);
    } catch (e: any) {
      setTestResult({ success: false, msg: e.message || 'Alert failed.' });
      setTimeout(() => setTestResult(null), 4000);
    } finally {
      setIsTesting(false);
    }
  };

  // Styled brands matching platform identity in a warm/light layout
  const getPlatformStyle = (platform: string) => {
    switch (platform) {
      case 'amazon':
        return 'bg-amber-50 text-amber-700 border-amber-200/60';
      case 'flipkart':
        return 'bg-blue-50 text-blue-700 border-blue-200/60';
      case 'meesho':
        return 'bg-pink-50 text-pink-700 border-pink-200/60';
      default:
        return 'bg-stone-100 text-stone-700 border-stone-200/60';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'watching':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Watching
          </span>
        );
      case 'triggered':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <Target className="w-3 h-3" />
            Price Target Hit
          </span>
        );
      case 'paused':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-stone-100 text-stone-600 border border-stone-200">
            Paused
          </span>
        );
      case 'expired':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            Expired
          </span>
        );
      default:
        return null;
    }
  };

  const formatTime = (isoString: string | null) => {
    if (!isoString) return 'Never';
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      className="relative flex flex-col bg-white border border-[#E5E0DA] hover:border-[#D97757]/30 rounded-2xl p-5 shadow-[0_2px_8px_rgba(25,25,25,0.03)] hover:shadow-[0_12px_30px_rgba(25,25,25,0.06)] transition-all duration-300 overflow-hidden group"
    >
      {/* Background Accent Lines */}
      <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-transparent via-[#D97757]/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

      {/* Header Info */}
      <div className="relative flex gap-4 items-start">
        {/* Product Image */}
        <div className="w-16 h-16 rounded-xl bg-[#FBF9F6] border border-[#E5E0DA] flex items-center justify-center overflow-hidden flex-shrink-0 shadow-2xs relative">
          {watch.image_url ? (
            <img 
              src={watch.image_url} 
              alt={watch.product_name} 
              className="w-full h-full object-contain p-1 group-hover:scale-105 transition-transform duration-500"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          ) : (
            <ShoppingBag className="w-6 h-6 text-[#85827D]" />
          )}
        </div>

        {/* Title, Platform, Status */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
            <span className={`px-2 py-0.5 rounded text-[9px] uppercase font-extrabold tracking-wider border ${getPlatformStyle(watch.platform)}`}>
              {watch.platform}
            </span>
            {getStatusBadge(watch.status)}
          </div>
          
          <h3 className="text-xs font-bold text-[#191919] leading-snug line-clamp-2 pr-4 group-hover:text-[#D97757] transition-colors duration-200">
            {watch.product_name}
          </h3>
        </div>

        {/* External Link */}
        <a 
          href={watch.product_url} 
          target="_blank" 
          rel="noopener noreferrer" 
          className="p-1.5 rounded-lg bg-[#FBF9F6] border border-[#E5E0DA] text-[#5E5B56] hover:text-[#191919] hover:bg-[#F4F0EB] transition-all duration-200 flex-shrink-0"
          title="Open Product Link"
        >
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>

      {/* Middle row: Price values & Sparkline */}
      <div className="relative mt-4 flex justify-between items-end border-y border-[#E5E0DA]/60 py-4">
        {/* Prices */}
        <div className="space-y-1.5">
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-[#191919] tracking-tight">
              ₹{watch.current_price !== null ? watch.current_price.toLocaleString('en-IN') : '---'}
            </span>
            {discount > 0 && (
              <span className="inline-flex items-center text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 px-1.5 py-0.5 rounded">
                <TrendingDown className="w-3 h-3 mr-0.5" />
                {discount}% Off
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-[10px] text-[#5E5B56]">
            <div className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500/80" />
              Target: <span className="font-bold text-[#191919]">₹{watch.target_price.toLocaleString('en-IN')}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/80" />
              Lowest: <span className="font-bold text-[#191919]">₹{watch.lowest_price ? watch.lowest_price.toLocaleString('en-IN') : '---'}</span>
            </div>
            {watch.original_price && (
              <div className="col-span-2 text-stone-400">
                Original: <span className="line-through">₹{watch.original_price.toLocaleString('en-IN')}</span>
              </div>
            )}
          </div>
        </div>

        {/* Inline Sparkline */}
        <div className="flex flex-col items-end gap-1">
          <span className="text-[9px] text-[#85827D] font-bold tracking-wider uppercase">History Mini-log</span>
          {renderSparkline()}
        </div>
      </div>

      {/* Footer Info & Action buttons */}
      <div className="relative mt-4 flex items-center justify-between">
        <div className="text-[10px] text-[#85827D]">
          <span>Checked: {formatTime(watch.last_checked_at)}</span>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-1">
          {/* Detailed History Chart */}
          <button
            onClick={() => onViewHistory(watch)}
            className="p-1.5 rounded-lg bg-[#FBF9F6] hover:bg-[#F4F0EB] text-[#5E5B56] hover:text-[#191919] border border-[#E5E0DA] transition-all duration-200"
            title="Analytics Chart"
          >
            <LineChart className="w-3.5 h-3.5" />
          </button>

          {/* Manually Run Scrape */}
          <button
            onClick={handleRefresh}
            disabled={isRefreshing || watch.status === 'paused'}
            className={`p-1.5 rounded-lg bg-[#FBF9F6] hover:bg-[#F4F0EB] text-[#5E5B56] hover:text-[#191919] border border-[#E5E0DA] transition-all duration-200 disabled:opacity-30 disabled:pointer-events-none ${isRefreshing ? 'animate-spin' : ''}`}
            title="Check Price Now"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>

          {/* Test Alerts */}
          <button
            onClick={handleTestAlert}
            disabled={isTesting || (!watch.alert_email && !watch.alert_whatsapp)}
            className="p-1.5 rounded-lg bg-[#FBF9F6] hover:bg-[#F4F0EB] text-[#5E5B56] hover:text-[#191919] border border-[#E5E0DA] transition-all duration-200 disabled:opacity-30 disabled:pointer-events-none"
            title="Dispatch Test Alert"
          >
            <Bell className="w-3.5 h-3.5" />
          </button>

          {/* Play/Pause */}
          <button
            onClick={handleToggleStatus}
            disabled={isPausing || watch.status === 'expired'}
            className={`p-1.5 rounded-lg border transition-all duration-200 disabled:opacity-30 disabled:pointer-events-none ${
              watch.status === 'paused'
                ? 'bg-amber-50/50 hover:bg-amber-100 text-[#D97757] border-amber-200/60'
                : 'bg-[#FBF9F6] hover:bg-[#F4F0EB] text-[#5E5B56] hover:text-[#191919] border-[#E5E0DA]'
            }`}
            title={watch.status === 'paused' ? 'Resume Monitor' : 'Pause Monitor'}
          >
            {watch.status === 'paused' ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
          </button>

          {/* Delete */}
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 transition-all duration-200"
            title="Delete Watcher"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Floating feedback message */}
      {testResult && (
        <div className={`absolute bottom-3 left-3 right-3 text-center py-1 px-3 rounded-lg text-[10px] font-semibold flex items-center justify-center gap-1 z-10 border transition-all duration-300 ${
          testResult.success
            ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
            : 'bg-rose-50 border-rose-200 text-rose-800'
        }`}>
          {!testResult.success && <AlertTriangle className="w-3.5 h-3.5" />}
          {testResult.msg}
        </div>
      )}
    </motion.div>
  );
}
