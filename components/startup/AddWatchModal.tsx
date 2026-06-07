'use client';

import React, { useState, useEffect } from 'react';
import { X, ArrowRight, ArrowLeft, Tag, Mail, AlertTriangle, CheckCircle, ShieldAlert } from 'lucide-react';
import { WatchPlatform } from '../../types';

interface AddWatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (watchData: {
    productName: string;
    productUrl: string;
    platform: WatchPlatform;
    targetPrice: number;
    checkInterval: number;
    alertEmail: string | null;
    alertWhatsapp: string | null;
  }) => Promise<void>;
  projectId: string | null;
}

export default function AddWatchModal({ isOpen, onClose, onSubmit, projectId }: AddWatchModalProps) {
  const [step, setStep] = useState(1);
  const [url, setUrl] = useState('');
  const [platform, setPlatform] = useState<WatchPlatform>('custom');
  const [productName, setProductName] = useState('');
  
  const [targetPrice, setTargetPrice] = useState('');
  const [checkInterval, setCheckInterval] = useState(6); // default 6 hours
  const [enableEmail, setEnableEmail] = useState(true);
  const [alertEmail, setAlertEmail] = useState('');
  const [enableWhatsapp, setEnableWhatsapp] = useState(false);
  const [alertWhatsapp, setAlertWhatsapp] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-detect platform when URL changes
  useEffect(() => {
    if (!url) return;
    const lowerUrl = url.toLowerCase();
    if (lowerUrl.includes('amazon.')) {
      setPlatform('amazon');
      if (!productName) {
        const match = url.match(/\/dp\/([A-Z0-9]+)/i) || url.match(/\/gp\/product\/([A-Z0-9]+)/i);
        setProductName(match ? `Amazon Product (${match[1]})` : 'Amazon Tracked Product');
      }
    } else if (lowerUrl.includes('flipkart.com')) {
      setPlatform('flipkart');
      if (!productName) {
        setProductName('Flipkart Tracked Product');
      }
    } else if (lowerUrl.includes('meesho.com')) {
      setPlatform('meesho');
      if (!productName) {
        setProductName('Meesho Tracked Product');
      }
    } else {
      setPlatform('custom');
      if (!productName) {
        try {
          const domain = new URL(url).hostname.replace('www.', '');
          setProductName(`${domain} Tracked Product`);
        } catch {
          setProductName('Custom Tracked Product');
        }
      }
    }
  }, [url]);

  if (!isOpen) return null;

  const handleNextStep = () => {
    setError(null);
    if (step === 1) {
      if (!url.trim()) {
        setError('Please enter a product URL.');
        return;
      }
      try {
        new URL(url);
      } catch {
        setError('Please enter a valid absolute URL (starting with http:// or https://).');
        return;
      }
      if (!productName.trim()) {
        setError('Please enter a product name for tracking.');
        return;
      }
      setStep(2);
    }
  };

  const handlePrevStep = () => {
    setStep(s => s - 1);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    const targetNum = parseFloat(targetPrice);
    if (isNaN(targetNum) || targetNum <= 0) {
      setError('Please enter a valid target price greater than 0.');
      return;
    }

    if (enableEmail && !alertEmail.trim()) {
      setError('Please enter a valid email address for price drop notifications.');
      return;
    }

    if (enableWhatsapp && !alertWhatsapp.trim()) {
      setError('Please enter a valid WhatsApp phone number for notifications.');
      return;
    }

    setLoading(true);
    try {
      await onSubmit({
        productName: productName.trim(),
        productUrl: url.trim(),
        platform,
        targetPrice: targetNum,
        checkInterval: Number(checkInterval),
        alertEmail: enableEmail ? alertEmail.trim() : null,
        alertWhatsapp: enableWhatsapp ? alertWhatsapp.trim() : null
      });
      
      // Reset State
      setStep(1);
      setUrl('');
      setProductName('');
      setTargetPrice('');
      setAlertEmail('');
      setAlertWhatsapp('');
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create price watch.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-[#191919]/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
      {/* Modal Card */}
      <div className="relative w-full max-w-lg bg-white border border-[#E5E0DA] rounded-2xl overflow-hidden shadow-2xl flex flex-col font-dmsans">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[#E5E0DA] bg-[#FBF9F6]">
          <div className="flex gap-2.5 items-center">
            <div className="w-8 h-8 rounded-lg bg-[#D97757]/10 border border-[#D97757]/20 flex items-center justify-center text-[#D97757]">
              <Tag className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-black text-[#191919] leading-tight">Create Price Watch Agent</h2>
              <p className="text-[10px] text-[#5E5B56] font-bold">Step {step} of 2</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-white text-[#5E5B56] hover:text-[#191919] hover:bg-[#FBF9F6] border border-[#E5E0DA] transition-all duration-200 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Step Progress Bar */}
        <div className="h-1 w-full bg-[#E5E0DA]">
          <div 
            className="h-full bg-[#D97757] transition-all duration-300"
            style={{ width: `${(step / 2) * 100}%` }}
          />
        </div>

        {/* Form Content */}
        <form onSubmit={handleSubmit} className="p-6 flex-1 flex flex-col gap-4 bg-[#FBF9F6]">
          {error && (
            <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 flex gap-2 text-rose-700 text-xs font-semibold">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4 animate-slideIn">
              {/* Product URL */}
              <div>
                <label className="block text-[10px] font-black text-[#85827D] uppercase tracking-wider mb-2">Product Web URL</label>
                <input
                  type="url"
                  placeholder="Paste Amazon India, Flipkart, or Meesho product link..."
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="w-full bg-white border border-[#E5E0DA] rounded-xl px-4 py-3 text-sm text-[#191919] focus:outline-none focus:border-[#D97757] transition-all placeholder-[#85827D]"
                  required
                />
                <span className="text-[9px] text-[#5E5B56] font-medium mt-1.5 block leading-normal">
                  Supported engines: Amazon India, Flipkart, Meesho. Other domains will fall back to dynamic HTML custom selectors.
                </span>
              </div>

              {/* Detected Platform */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-[#85827D] uppercase tracking-wider mb-2">Scraper Engine</label>
                  <select
                    value={platform}
                    onChange={(e) => setPlatform(e.target.value as WatchPlatform)}
                    className="w-full bg-white border border-[#E5E0DA] rounded-xl px-4 py-3 text-sm text-[#191919] focus:outline-none focus:border-[#D97757] transition-all"
                  >
                    <option value="amazon">Amazon Engine</option>
                    <option value="flipkart">Flipkart Engine</option>
                    <option value="meesho">Meesho Engine</option>
                    <option value="custom">Custom Selector Engine</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-[#85827D] uppercase tracking-wider mb-2">Product Identifier</label>
                  <input
                    type="text"
                    placeholder="E.g., iPhone 15 Pro Max"
                    value={productName}
                    onChange={(e) => setProductName(e.target.value)}
                    className="w-full bg-white border border-[#E5E0DA] rounded-xl px-4 py-3 text-sm text-[#191919] focus:outline-none focus:border-[#D97757] transition-all placeholder-[#85827D]"
                    required
                  />
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4 animate-slideIn">
              {/* Target Price */}
              <div>
                <label className="block text-[10px] font-black text-[#85827D] uppercase tracking-wider mb-2">Target Price (INR)</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-[#5E5B56] font-extrabold">₹</div>
                  <input
                    type="number"
                    placeholder="Alert when price drops below this value..."
                    value={targetPrice}
                    onChange={(e) => setTargetPrice(e.target.value)}
                    className="w-full bg-white border border-[#E5E0DA] rounded-xl pl-8 pr-4 py-3 text-sm text-[#191919] focus:outline-none focus:border-[#D97757] transition-all placeholder-[#85827D]"
                    required
                  />
                </div>
              </div>

              {/* Check Interval */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-[10px] font-black text-[#85827D] uppercase tracking-wider">Check Schedule Interval</label>
                  <span className="text-[10px] font-black text-[#D97757] bg-[#D97757]/10 px-2 py-0.5 rounded">Every {checkInterval} Hours</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="24"
                  value={checkInterval}
                  onChange={(e) => setCheckInterval(Number(e.target.value))}
                  className="w-full h-1 bg-[#E5E0DA] rounded-lg appearance-none cursor-pointer accent-[#D97757] mt-2"
                />
                <div className="flex justify-between text-[9px] text-[#85827D] font-bold px-1 mt-1">
                  <span>1 Hour</span>
                  <span>12 Hours</span>
                  <span>24 Hours</span>
                </div>
                <div className="flex items-center gap-1.5 mt-3.5 text-[9px] text-[#5E5B56] border border-[#E5E0DA] bg-white p-2 rounded-lg">
                  <ShieldAlert className="w-3.5 h-3.5 text-[#D97757] flex-shrink-0" />
                  <span>Enforcing a minimum interval of 1 hour to respect platform rate limits.</span>
                </div>
              </div>

              {/* Email Alerts Setup */}
              <div className="border-t border-[#E5E0DA] pt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#191919]">Enable Email Notifications</span>
                  <input
                    type="checkbox"
                    checked={enableEmail}
                    onChange={(e) => setEnableEmail(e.target.checked)}
                    className="w-4 h-4 rounded border-[#E5E0DA] text-[#D97757] focus:ring-[#D97757] bg-white"
                  />
                </div>
                {enableEmail && (
                  <input
                    type="email"
                    placeholder="Enter recipient email address..."
                    value={alertEmail}
                    onChange={(e) => setAlertEmail(e.target.value)}
                    className="w-full bg-white border border-[#E5E0DA] rounded-xl px-4 py-2.5 text-xs text-[#191919] focus:outline-none focus:border-[#D97757] transition-all placeholder-[#85827D]"
                    required={enableEmail}
                  />
                )}
              </div>

              {/* WhatsApp Alerts Setup */}
              <div className="border-t border-[#E5E0DA] pt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#191919]">Enable WhatsApp Alerts</span>
                  <input
                    type="checkbox"
                    checked={enableWhatsapp}
                    onChange={(e) => setEnableWhatsapp(e.target.checked)}
                    className="w-4 h-4 rounded border-[#E5E0DA] text-[#D97757] focus:ring-[#D97757] bg-white"
                  />
                </div>
                {enableWhatsapp && (
                  <input
                    type="tel"
                    placeholder="WhatsApp number (+919988776655 format)..."
                    value={alertWhatsapp}
                    onChange={(e) => setAlertWhatsapp(e.target.value)}
                    className="w-full bg-white border border-[#E5E0DA] rounded-xl px-4 py-2.5 text-xs text-[#191919] focus:outline-none focus:border-[#D97757] transition-all placeholder-[#85827D]"
                    required={enableWhatsapp}
                  />
                )}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-between items-center gap-4 mt-6 pt-4 border-t border-[#E5E0DA]">
            {step > 1 ? (
              <button
                type="button"
                onClick={handlePrevStep}
                className="px-4 py-2.5 rounded-xl border border-[#E5E0DA] bg-white hover:bg-[#F4F0EB] text-[#5E5B56] hover:text-[#191919] transition-all text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Back
              </button>
            ) : (
              <div />
            )}

            {step < 2 ? (
              <button
                type="button"
                onClick={handleNextStep}
                className="px-5 py-2.5 rounded-xl bg-[#D97757] hover:bg-[#C46747] text-white font-extrabold transition-all text-xs flex items-center gap-1.5 ml-auto shadow-[0_2px_8px_rgba(217,119,87,0.2)] cursor-pointer"
              >
                Continue
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2.5 rounded-xl bg-[#D97757] hover:bg-[#C46747] disabled:bg-[#D97757]/50 text-white font-extrabold transition-all text-xs flex items-center gap-1.5 ml-auto shadow-[0_2px_8px_rgba(217,119,87,0.2)] cursor-pointer"
              >
                {loading ? 'Starting Agent...' : 'Start Price Watching'}
                <CheckCircle className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
