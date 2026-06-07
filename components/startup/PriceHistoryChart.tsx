'use client';

import React, { useEffect, useState } from 'react';
import { X, Calendar, ArrowDownRight, Tag, ShieldCheck, RefreshCw } from 'lucide-react';
import { PriceWatch, PriceHistory } from '../../types';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Filler,
  Legend
);

interface PriceHistoryChartProps {
  watch: PriceWatch | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function PriceHistoryChart({ watch, isOpen, onClose }: PriceHistoryChartProps) {
  const [history, setHistory] = useState<PriceHistory[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && watch) {
      fetchHistory();
    }
  }, [isOpen, watch]);

  const fetchHistory = async () => {
    if (!watch) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/price-watch/history?watchId=${watch.id}`);
      const data = await res.json();
      if (data.success) {
        setHistory(data.history || []);
      } else {
        setError(data.error || 'Failed to load history.');
      }
    } catch (e: any) {
      setError(e.message || 'An error occurred.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !watch) return null;

  // Prepare chart data
  const chartLabels = history.map((h) => {
    const date = new Date(h.scraped_at);
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  });

  const chartPrices = history.map((h) => Number(h.price));

  // Determine chart trend color (green for down, terracotta for up/flat)
  const isDown = chartPrices.length > 1 && chartPrices[chartPrices.length - 1] < chartPrices[0];
  const themeColor = isDown ? '#10B981' : '#D97757';

  const data = {
    labels: chartLabels.length > 0 ? chartLabels : ['Initial Setup'],
    datasets: [
      {
        label: 'Current MSRP (₹)',
        data: chartPrices.length > 0 ? chartPrices : [Number(watch.current_price || watch.target_price)],
        borderColor: themeColor,
        backgroundColor: (context: any) => {
          const chart = context.chart;
          const { ctx, chartArea } = chart;
          if (!chartArea) return null;
          const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
          gradient.addColorStop(0, `${themeColor}20`);
          gradient.addColorStop(1, `${themeColor}00`);
          return gradient;
        },
        fill: true,
        tension: 0.3,
        borderWidth: 2,
        pointBackgroundColor: themeColor,
        pointBorderColor: '#ffffff',
        pointHoverRadius: 6,
        pointRadius: history.length > 20 ? 1 : 4,
      },
      // Target price line dataset
      {
        label: 'Target Price (₹)',
        data: Array(chartLabels.length > 0 ? chartLabels.length : 1).fill(Number(watch.target_price)),
        borderColor: '#F59E0B',
        borderDash: [5, 5],
        borderWidth: 1.5,
        fill: false,
        pointRadius: 0,
        pointHoverRadius: 0
      }
    ]
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: 'top' as const,
        labels: {
          color: '#5E5B56',
          font: {
            family: 'DM Sans',
            size: 11,
            weight: 'bold' as const
          }
        }
      },
      tooltip: {
        backgroundColor: '#191919',
        borderColor: '#E5E0DA',
        borderWidth: 1,
        titleColor: '#ffffff',
        bodyColor: '#cbd5e1',
        padding: 10,
        boxPadding: 4,
        usePointStyle: true
      }
    },
    scales: {
      x: {
        grid: {
          color: '#E5E0DA'
        },
        ticks: {
          color: '#85827D',
          font: {
            size: 9
          },
          maxRotation: 45,
          minRotation: 0
        }
      },
      y: {
        grid: {
          color: '#E5E0DA'
        },
        ticks: {
          color: '#85827D',
          font: {
            size: 9
          },
          callback: (value: any) => `₹${value.toLocaleString('en-IN')}`
        }
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-[#191919]/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
      {/* Modal Container */}
      <div className="relative w-full max-w-4xl bg-white border border-[#E5E0DA] rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh] font-dmsans">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[#E5E0DA] bg-[#FBF9F6]">
          <div className="flex gap-3 items-center">
            <div className="w-10 h-10 rounded-lg bg-[#D97757]/10 border border-[#D97757]/20 flex items-center justify-center text-[#D97757]">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-black text-[#191919] leading-tight">Price History Analytics</h2>
              <p className="text-[11px] text-[#5E5B56] truncate max-w-lg font-semibold">{watch.product_name}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={fetchHistory}
              disabled={loading}
              className="p-2 rounded-lg bg-white text-[#5E5B56] hover:text-[#191919] hover:bg-[#FBF9F6] border border-[#E5E0DA] transition-all duration-200 cursor-pointer"
              title="Refresh History"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg bg-white text-[#5E5B56] hover:text-[#191919] hover:bg-[#FBF9F6] border border-[#E5E0DA] transition-all duration-200 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-[#FBF9F6]">
          {/* Quick Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white border border-[#E5E0DA] p-4 rounded-xl flex flex-col justify-between">
              <span className="text-[10px] text-[#85827D] uppercase font-bold tracking-wider">Current Price</span>
              <span className="text-xl font-black text-[#191919] mt-1">₹{watch.current_price !== null ? watch.current_price.toLocaleString('en-IN') : '---'}</span>
            </div>
            <div className="bg-white border border-[#E5E0DA] p-4 rounded-xl flex flex-col justify-between">
              <span className="text-[10px] text-[#85827D] uppercase font-bold tracking-wider">Target Price</span>
              <span className="text-xl font-black text-amber-600 mt-1">₹{watch.target_price.toLocaleString('en-IN')}</span>
            </div>
            <div className="bg-white border border-[#E5E0DA] p-4 rounded-xl flex flex-col justify-between">
              <span className="text-[10px] text-[#85827D] uppercase font-bold tracking-wider">Lowest Price</span>
              <span className="text-xl font-black text-emerald-600 mt-1">₹{watch.lowest_price ? watch.lowest_price.toLocaleString('en-IN') : '---'}</span>
            </div>
            <div className="bg-white border border-[#E5E0DA] p-4 rounded-xl flex flex-col justify-between">
              <span className="text-[10px] text-[#85827D] uppercase font-bold tracking-wider">Original Price</span>
              <span className="text-xl font-black text-stone-400 line-through mt-1">₹{watch.original_price ? watch.original_price.toLocaleString('en-IN') : '---'}</span>
            </div>
          </div>

          {/* Chart Section */}
          <div className="relative bg-white border border-[#E5E0DA] rounded-2xl p-5 min-h-[350px] flex items-center justify-center">
            {loading ? (
              <div className="flex flex-col items-center gap-3">
                <RefreshCw className="w-8 h-8 text-[#D97757] animate-spin" />
                <span className="text-xs text-[#5E5B56] font-bold">Loading history logs...</span>
              </div>
            ) : error ? (
              <div className="text-rose-600 text-sm font-semibold">{error}</div>
            ) : history.length === 0 ? (
              <div className="text-[#85827D] text-xs font-semibold">No price logs recorded yet. Run a price check to begin history logging.</div>
            ) : (
              <div className="absolute inset-5">
                <Line data={data} options={options} />
              </div>
            )}
          </div>

          {/* Table view for details */}
          {history.length > 0 && (
            <div className="bg-white border border-[#E5E0DA] rounded-xl overflow-hidden shadow-2xs">
              <div className="p-4 border-b border-[#E5E0DA] bg-[#F4F0EB]">
                <h3 className="text-xs font-black text-[#191919] uppercase tracking-wider">Recent Scrapes Logs</h3>
              </div>
              <div className="divide-y divide-[#E5E0DA] max-h-48 overflow-y-auto">
                {history.slice().reverse().map((log, index) => (
                  <div key={log.id || index} className="flex justify-between items-center p-3 text-xs text-[#5E5B56] hover:bg-[#FBF9F6] transition-colors">
                    <span className="flex items-center gap-1.5 font-medium">
                      <Calendar className="w-3.5 h-3.5 text-[#85827D]" />
                      {new Date(log.scraped_at).toLocaleString()}
                    </span>
                    <div className="flex items-center gap-4">
                      {log.deal_score > 0 && (
                        <span className="text-[9px] font-extrabold text-emerald-800 bg-emerald-50 border border-emerald-200/60 px-1.5 py-0.5 rounded">
                          Score: {log.deal_score}
                        </span>
                      )}
                      <span className={log.in_stock ? 'text-emerald-700 font-bold' : 'text-rose-700 font-bold'}>
                        {log.in_stock ? 'In Stock' : 'Out of Stock'}
                      </span>
                      <span className="font-extrabold text-[#191919]">
                        ₹{Number(log.price).toLocaleString('en-IN')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#E5E0DA] bg-[#FBF9F6] flex justify-between items-center text-xs text-[#5E5B56]">
          <div className="flex gap-4 items-center font-bold">
            <span className="flex items-center gap-1"><ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> Auto-Interval: {watch.check_interval}h</span>
            <span className="flex items-center gap-1"><Tag className="w-3.5 h-3.5 text-amber-600" /> Target: ₹{watch.target_price.toLocaleString('en-IN')}</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl bg-white text-[#191919] hover:bg-[#F4F0EB] transition-all duration-200 border border-[#E5E0DA] font-bold cursor-pointer"
          >
            Close Details
          </button>
        </div>
      </div>
    </div>
  );
}
