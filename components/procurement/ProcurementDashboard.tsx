'use client';

import React, { useState, useEffect } from 'react';
import {
  ShoppingCart,
  Search,
  Clock,
  BarChart3,
  Plus,
  RefreshCw,
  Star,
  ArrowRight,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  X,
  Package,
  Zap,
  DollarSign,
  PieChart
} from 'lucide-react';
import LiveFeed from '../stream/LiveFeed';
import { StreamEventType } from '../../types';

interface ProcurementItem {
  id: string;
  project_id: string;
  name: string;
  category: string;
  current_provider: string | null;
  current_price: number | null;
  billing_cycle: string;
  currency: string;
  renewal_date: string | null;
  users_count: number | null;
  satisfaction: number | null;
  status: string;
  notes: string | null;
  alternatives_count: number;
  created_at: string;
}

interface Alternative {
  id: string;
  item_id: string;
  provider_name: string;
  price: number;
  billing_cycle: string;
  features_match: number;
  savings_amount: number;
  recommendation: string;
  source_url: string;
  created_at: string;
}

interface ProcurementRequest {
  id: string;
  project_id: string;
  requirement: string;
  budget: number | null;
  timeline: string | null;
  status: string;
  top_picks: any[];
  recommendation: string | null;
  created_at: string;
}

interface RenewalAlert {
  item: ProcurementItem;
  daysLeft: number;
  renewalDate: string;
  bestAlternative: Alternative | null;
  potentialSavings: number;
  alternativesCount: number;
}

interface StackReport {
  totalMonthlySpend: number;
  totalAnnualSpend: number;
  toolsCount: number;
  categoryBreakdown: { category: string; count: number; monthlySpend: number; tools: string[]; percentage: number }[];
  potentialSavings: number;
  overview: string;
  redundancies: { tools: string[]; category: string; issue: string; suggestion: string }[];
  recommendations: { priority: string; title: string; description: string }[];
}

interface ProcurementDashboardProps {
  projectId: string;
  userId: string;
}

export default function ProcurementDashboard({ projectId, userId }: ProcurementDashboardProps) {
  const [activeTab, setActiveTab] = useState<'stack' | 'find' | 'renewals' | 'report'>('stack');
  const [items, setItems] = useState<ProcurementItem[]>([]);
  const [requests, setRequests] = useState<ProcurementRequest[]>([]);
  const [renewals, setRenewals] = useState<RenewalAlert[]>([]);
  const [report, setReport] = useState<StackReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [reportLoading, setReportLoading] = useState(false);
  const [renewalsLoading, setRenewalsLoading] = useState(false);

  // Add tool form
  const [showAddForm, setShowAddForm] = useState(false);
  const [addLoading, setAddLoading] = useState(false);
  const [formName, setFormName] = useState('');
  const [formCategory, setFormCategory] = useState('SaaS');
  const [formProvider, setFormProvider] = useState('');
  const [formPrice, setFormPrice] = useState('');
  const [formBilling, setFormBilling] = useState('monthly');
  const [formRenewal, setFormRenewal] = useState('');
  const [formSatisfaction, setFormSatisfaction] = useState(3);

  // Alternatives view
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [alternatives, setAlternatives] = useState<Alternative[]>([]);
  const [altsLoading, setAltsLoading] = useState(false);

  // Find tool form
  const [findRequirement, setFindRequirement] = useState('');
  const [findBudget, setFindBudget] = useState('');
  const [findLoading, setFindLoading] = useState(false);

  // Fetch procurement items
  const fetchItems = async () => {
    try {
      const res = await fetch(`/api/procurement/items?projectId=${projectId}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.items)) {
        setItems(data.items);
      }
    } catch (err) {
      console.error('Failed to fetch procurement items:', err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch requests
  const fetchRequests = async () => {
    try {
      const res = await fetch(`/api/procurement/request?projectId=${projectId}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.requests)) {
        setRequests(data.requests);
      }
    } catch (err) {
      console.error('Failed to fetch procurement requests:', err);
    }
  };

  useEffect(() => {
    fetchItems();
    fetchRequests();
  }, [projectId]);

  // Polling for evaluating items and researching requests
  useEffect(() => {
    const hasEvaluating = items.some(i => i.status === 'evaluating');
    const hasResearching = requests.some(r => r.status === 'researching');
    if (!hasEvaluating && !hasResearching) return;

    const interval = setInterval(() => {
      if (hasEvaluating) fetchItems();
      if (hasResearching) fetchRequests();
    }, 4000);

    return () => clearInterval(interval);
  }, [items, requests, projectId]);

  // Compute header stats
  const totalMonthlySpend = items.reduce((sum, item) => {
    const price = Number(item.current_price) || 0;
    if (item.billing_cycle === 'monthly') return sum + price;
    if (item.billing_cycle === 'annual') return sum + price / 12;
    return sum;
  }, 0);

  const totalAnnualSpend = items.reduce((sum, item) => {
    const price = Number(item.current_price) || 0;
    if (item.billing_cycle === 'monthly') return sum + price * 12;
    if (item.billing_cycle === 'annual') return sum + price;
    if (item.billing_cycle === 'one-time') return sum + price;
    return sum;
  }, 0);

  const totalSavingsFound = alternatives.length > 0
    ? alternatives.reduce((sum, a) => sum + (Number(a.savings_amount) || 0), 0)
    : 0;

  // Add tool handler
  const handleAddTool = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName || !formCategory) return;
    setAddLoading(true);
    try {
      const res = await fetch('/api/procurement/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          name: formName,
          category: formCategory,
          currentProvider: formProvider || null,
          currentPrice: formPrice ? parseFloat(formPrice) : null,
          billingCycle: formBilling,
          renewalDate: formRenewal || null,
          satisfaction: formSatisfaction
        })
      });
      const data = await res.json();
      if (data.success) {
        setShowAddForm(false);
        setFormName(''); setFormProvider(''); setFormPrice(''); setFormRenewal('');
        fetchItems();
      } else {
        alert(`Failed to add tool: ${data.error || 'Unknown error'}`);
      }
    } catch (err) {
      console.error('Failed to add tool:', err);
      alert('Error adding tool.');
    } finally {
      setAddLoading(false);
    }
  };

  // Find alternatives handler
  const handleFindAlternatives = async (itemId: string) => {
    try {
      await fetch('/api/procurement/alternatives', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId })
      });
      fetchItems();
    } catch (err) {
      console.error('Failed to trigger alternative search:', err);
    }
  };

  // View alternatives handler
  const handleViewAlternatives = async (itemId: string) => {
    setSelectedItemId(itemId);
    setAltsLoading(true);
    try {
      const res = await fetch(`/api/procurement/alternatives?itemId=${itemId}`);
      const data = await res.json();
      if (data.success) {
        setAlternatives(data.alternatives || []);
      }
    } catch (err) {
      console.error('Failed to fetch alternatives:', err);
    } finally {
      setAltsLoading(false);
    }
  };

  // Find tool handler
  const handleFindTool = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!findRequirement) return;
    setFindLoading(true);
    try {
      const res = await fetch('/api/procurement/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          requirement: findRequirement,
          budget: findBudget ? parseFloat(findBudget) : null,
          timeline: 'ASAP'
        })
      });
      const data = await res.json();
      if (data.success) {
        setFindRequirement(''); setFindBudget('');
        fetchRequests();
      }
    } catch (err) {
      console.error('Failed to submit request:', err);
    } finally {
      setFindLoading(false);
    }
  };

  // Renewals handler
  const handleCheckRenewals = async () => {
    setRenewalsLoading(true);
    try {
      const res = await fetch(`/api/procurement/items?projectId=${projectId}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.items)) {
        const now = new Date();
        const fourteenDaysLater = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
        const renewing = data.items.filter((item: ProcurementItem) => {
          if (!item.renewal_date) return false;
          const rd = new Date(item.renewal_date);
          return rd >= now && rd <= fourteenDaysLater;
        });
        const alerts: RenewalAlert[] = renewing.map((item: ProcurementItem) => {
          const rd = new Date(item.renewal_date!);
          const daysLeft = Math.ceil((rd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          return {
            item,
            daysLeft,
            renewalDate: item.renewal_date!,
            bestAlternative: null,
            potentialSavings: 0,
            alternativesCount: item.alternatives_count || 0
          };
        });
        setRenewals(alerts);
      }
    } catch (err) {
      console.error('Failed to check renewals:', err);
    } finally {
      setRenewalsLoading(false);
    }
  };

  // Report handler
  const handleGenerateReport = async () => {
    setReportLoading(true);
    try {
      const res = await fetch(`/api/procurement/report?projectId=${projectId}`);
      const data = await res.json();
      if (data.success && data.report) {
        setReport(data.report);
      }
    } catch (err) {
      console.error('Failed to generate report:', err);
    } finally {
      setReportLoading(false);
    }
  };

  // Render satisfaction stars
  const renderStars = (score: number | null) => {
    const s = score || 0;
    return (
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map(i => (
          <Star
            key={i}
            className={`w-3 h-3 ${i <= s ? 'text-[#e8a55a] fill-[#e8a55a]' : 'text-gray-300'}`}
          />
        ))}
      </div>
    );
  };

  // Generate donut chart CSS
  const getDonutGradient = (breakdown: StackReport['categoryBreakdown']) => {
    const colors = ['#cc785c', '#5db872', '#e8a55a', '#6b8fd4', '#c64545', '#9b72cf', '#4ec6c1', '#d4856b'];
    let accumulated = 0;
    const segments = breakdown.map((cat, i) => {
      const start = accumulated;
      accumulated += cat.percentage;
      return `${colors[i % colors.length]} ${start}% ${accumulated}%`;
    });
    return `conic-gradient(${segments.join(', ')})`;
  };

  const tabs = [
    { key: 'stack' as const, label: 'Stack', icon: Package },
    { key: 'find' as const, label: 'Find Tool', icon: Search },
    { key: 'renewals' as const, label: 'Renewals', icon: Clock },
    { key: 'report' as const, label: 'Report', icon: BarChart3 }
  ];

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-screen bg-canvas font-dmsans">
        <RefreshCw className="w-6 h-6 text-[#cc785c] animate-spin" />
        <span className="text-xs text-muted-soft mt-2.5">Loading Procurement Data...</span>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden font-dmsans">
      {/* Header Stats Row */}
      <div className="px-6 py-5 bg-white border-b border-hairline shrink-0">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Monthly Spend */}
          <div className="bg-canvas border border-hairline rounded-xl p-4 text-left">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-[#cc785c]/10 flex items-center justify-center">
                <DollarSign className="w-4 h-4 text-[#cc785c]" />
              </div>
              <span className="text-[10px] font-bold text-muted uppercase tracking-wider">Monthly Spend</span>
            </div>
            <span className="text-xl font-bold text-ink">₹{Math.round(totalMonthlySpend).toLocaleString()}</span>
          </div>
          {/* Annual Spend */}
          <div className="bg-canvas border border-hairline rounded-xl p-4 text-left">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-[#6b8fd4]/10 flex items-center justify-center">
                <PieChart className="w-4 h-4 text-[#6b8fd4]" />
              </div>
              <span className="text-[10px] font-bold text-muted uppercase tracking-wider">Annual Spend</span>
            </div>
            <span className="text-xl font-bold text-ink">₹{Math.round(totalAnnualSpend).toLocaleString()}</span>
          </div>
          {/* Tools Active */}
          <div className="bg-canvas border border-hairline rounded-xl p-4 text-left">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-[#5db872]/10 flex items-center justify-center">
                <Package className="w-4 h-4 text-[#5db872]" />
              </div>
              <span className="text-[10px] font-bold text-muted uppercase tracking-wider">Tools Active</span>
            </div>
            <span className="text-xl font-bold text-ink">{items.filter(i => i.status === 'active' || i.status === 'evaluating').length}</span>
          </div>
          {/* Savings Found */}
          <div className="bg-canvas border border-hairline rounded-xl p-4 text-left">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-[#e8a55a]/10 flex items-center justify-center">
                <TrendingDown className="w-4 h-4 text-[#e8a55a]" />
              </div>
              <span className="text-[10px] font-bold text-muted uppercase tracking-wider">Savings Found</span>
            </div>
            <span className="text-xl font-bold text-[#5db872]">₹{Math.round(totalSavingsFound).toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* Tab Bar */}
      <div className="px-6 bg-white border-b border-hairline flex items-center justify-between shrink-0 select-none">
        <div className="flex gap-4 text-xs font-semibold">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => {
                setActiveTab(tab.key);
                if (tab.key === 'renewals' && renewals.length === 0) handleCheckRenewals();
              }}
              className={`py-3.5 border-b-2 cursor-pointer transition-all flex items-center gap-1.5 ${
                activeTab === tab.key
                  ? 'border-[#cc785c] text-ink font-bold'
                  : 'border-transparent text-muted hover:text-ink'
              }`}
            >
              <tab.icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'stack' && (
          <button
            onClick={() => setShowAddForm(prev => !prev)}
            className="flex items-center gap-1 px-3 py-1.5 bg-[#cc785c] hover:bg-[#a9583e] text-white rounded-lg text-xs font-semibold cursor-pointer transition-colors shadow-2xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Tool</span>
          </button>
        )}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-6 bg-canvas">
        {/* ===== STACK TAB ===== */}
        {activeTab === 'stack' && (
          <div className="space-y-5">
            {/* Add Tool Form */}
            {showAddForm && (
              <div className="bg-white border border-hairline rounded-2xl p-5 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-serif text-base font-normal text-ink">Add New Tool</h3>
                  <button onClick={() => setShowAddForm(false)} className="text-muted hover:text-ink cursor-pointer">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <form onSubmit={handleAddTool} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-muted uppercase tracking-wider block">Tool Name *</label>
                    <input
                      type="text"
                      value={formName}
                      onChange={e => setFormName(e.target.value)}
                      placeholder="e.g. Slack, Notion, Figma"
                      className="w-full bg-white border border-[#E5E0DA] text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-[#cc785c]"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-muted uppercase tracking-wider block">Category *</label>
                    <select
                      value={formCategory}
                      onChange={e => setFormCategory(e.target.value)}
                      className="w-full bg-white border border-[#E5E0DA] text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-[#cc785c] cursor-pointer"
                    >
                      <option value="SaaS">SaaS</option>
                      <option value="Communication">Communication</option>
                      <option value="Design">Design</option>
                      <option value="Development">Development</option>
                      <option value="Analytics">Analytics</option>
                      <option value="Marketing">Marketing</option>
                      <option value="Finance">Finance</option>
                      <option value="HR">HR</option>
                      <option value="Productivity">Productivity</option>
                      <option value="Security">Security</option>
                      <option value="Infrastructure">Infrastructure</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-muted uppercase tracking-wider block">Provider</label>
                    <input
                      type="text"
                      value={formProvider}
                      onChange={e => setFormProvider(e.target.value)}
                      placeholder="e.g. Atlassian, Microsoft"
                      className="w-full bg-white border border-[#E5E0DA] text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-[#cc785c]"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-muted uppercase tracking-wider block">Price (₹)</label>
                    <input
                      type="number"
                      value={formPrice}
                      onChange={e => setFormPrice(e.target.value)}
                      placeholder="0"
                      className="w-full bg-white border border-[#E5E0DA] text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-[#cc785c]"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-muted uppercase tracking-wider block">Billing Cycle</label>
                    <select
                      value={formBilling}
                      onChange={e => setFormBilling(e.target.value)}
                      className="w-full bg-white border border-[#E5E0DA] text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-[#cc785c] cursor-pointer"
                    >
                      <option value="monthly">Monthly</option>
                      <option value="annual">Annual</option>
                      <option value="one-time">One-time</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-muted uppercase tracking-wider block">Renewal Date</label>
                    <input
                      type="date"
                      value={formRenewal}
                      onChange={e => setFormRenewal(e.target.value)}
                      className="w-full bg-white border border-[#E5E0DA] text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-[#cc785c]"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-muted uppercase tracking-wider block">Satisfaction ({formSatisfaction}/5)</label>
                    <div className="flex items-center gap-1 pt-1">
                      {[1, 2, 3, 4, 5].map(i => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => setFormSatisfaction(i)}
                          className="cursor-pointer"
                        >
                          <Star className={`w-5 h-5 ${i <= formSatisfaction ? 'text-[#e8a55a] fill-[#e8a55a]' : 'text-gray-300'}`} />
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="sm:col-span-2 lg:col-span-3 flex justify-end pt-2">
                    <button
                      type="submit"
                      disabled={addLoading || !formName}
                      className="px-5 py-2 bg-[#cc785c] hover:bg-[#a9583e] text-white rounded-lg text-xs font-bold transition-all shadow-2xs cursor-pointer disabled:opacity-50"
                    >
                      {addLoading ? (
                        <span className="flex items-center gap-1">
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          Adding...
                        </span>
                      ) : 'Add Tool'}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Items List */}
            {items.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 max-w-md mx-auto text-center space-y-5">
                <div className="w-16 h-16 rounded-full bg-[#cc785c]/10 flex items-center justify-center border border-[#cc785c]/20">
                  <ShoppingCart className="w-8 h-8 text-[#cc785c]" />
                </div>
                <div className="space-y-2">
                  <h2 className="font-serif text-2xl text-ink font-normal">AI Procurement Agent</h2>
                  <p className="text-sm text-muted leading-relaxed">
                    Track your startup&apos;s software stack, discover cheaper alternatives with AI, and never miss a renewal. Add your first tool to get started.
                  </p>
                </div>
                <button
                  onClick={() => setShowAddForm(true)}
                  className="px-6 py-2.5 bg-[#cc785c] hover:bg-[#a9583e] text-white rounded-lg text-xs font-bold transition-all shadow-sm cursor-pointer"
                >
                  Add Your First Tool
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {items.map(item => (
                  <div key={item.id} className="bg-white border border-hairline rounded-xl p-4 shadow-2xs hover:shadow-sm transition-shadow text-left">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="text-sm font-bold text-ink truncate">{item.name}</h4>
                          <span className="text-[9px] font-bold text-muted bg-surface-soft px-2 py-0.5 rounded-full uppercase tracking-wide shrink-0">
                            {item.category}
                          </span>
                          {item.status === 'evaluating' && (
                            <span className="text-[9px] font-bold text-blue-700 bg-blue-50 border border-blue-200/50 px-2 py-0.5 rounded-full animate-pulse uppercase tracking-wide shrink-0">
                              Evaluating...
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-[10px] text-muted">
                          {item.current_provider && <span>Provider: {item.current_provider}</span>}
                          <span className="font-semibold text-ink">₹{Number(item.current_price || 0).toLocaleString()}/{item.billing_cycle}</span>
                          {item.renewal_date && (
                            <span>Renews: {new Date(item.renewal_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                          )}
                          {renderStars(item.satisfaction)}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {item.alternatives_count > 0 && (
                          <button
                            onClick={() => handleViewAlternatives(item.id)}
                            className="text-[10px] font-bold text-[#5db872] bg-[#5db872]/10 border border-[#5db872]/20 px-3 py-1.5 rounded-lg cursor-pointer hover:bg-[#5db872]/20 transition-colors"
                          >
                            {item.alternatives_count} Alternatives
                          </button>
                        )}
                        <button
                          onClick={() => handleFindAlternatives(item.id)}
                          disabled={item.status === 'evaluating'}
                          className="flex items-center gap-1 text-[10px] font-bold text-[#cc785c] bg-[#cc785c]/10 border border-[#cc785c]/20 px-3 py-1.5 rounded-lg cursor-pointer hover:bg-[#cc785c]/20 transition-colors disabled:opacity-50"
                        >
                          <Search className="w-3 h-3" />
                          Find Alternatives
                        </button>
                      </div>
                    </div>

                    {/* Alternatives Table */}
                    {selectedItemId === item.id && alternatives.length > 0 && (
                      <div className="mt-4 border-t border-hairline pt-4">
                        <div className="flex items-center justify-between mb-3">
                          <h5 className="text-[10px] font-bold text-ink uppercase tracking-wider">Alternatives Comparison</h5>
                          <button onClick={() => setSelectedItemId(null)} className="text-muted hover:text-ink cursor-pointer">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        {altsLoading ? (
                          <div className="flex items-center gap-2 py-4 justify-center">
                            <RefreshCw className="w-4 h-4 text-[#cc785c] animate-spin" />
                            <span className="text-xs text-muted-soft">Loading alternatives...</span>
                          </div>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="border-b border-hairline">
                                  <th className="text-left py-2 px-2 text-[9px] font-bold text-muted uppercase tracking-wider">Provider</th>
                                  <th className="text-left py-2 px-2 text-[9px] font-bold text-muted uppercase tracking-wider">Price</th>
                                  <th className="text-left py-2 px-2 text-[9px] font-bold text-muted uppercase tracking-wider">Features Match</th>
                                  <th className="text-left py-2 px-2 text-[9px] font-bold text-muted uppercase tracking-wider">Savings</th>
                                  <th className="text-left py-2 px-2 text-[9px] font-bold text-muted uppercase tracking-wider">Recommendation</th>
                                  <th className="text-left py-2 px-2 text-[9px] font-bold text-muted uppercase tracking-wider"></th>
                                </tr>
                              </thead>
                              <tbody>
                                {alternatives.map(alt => (
                                  <tr key={alt.id} className="border-b border-hairline/50 hover:bg-surface-soft/30">
                                    <td className="py-2.5 px-2 font-semibold text-ink">{alt.provider_name}</td>
                                    <td className="py-2.5 px-2 text-ink">₹{Number(alt.price).toLocaleString()}/{alt.billing_cycle}</td>
                                    <td className="py-2.5 px-2">
                                      <div className="flex items-center gap-2">
                                        <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                          <div
                                            className={`h-full rounded-full ${alt.features_match >= 80 ? 'bg-[#5db872]' : alt.features_match >= 50 ? 'bg-[#e8a55a]' : 'bg-[#c64545]'}`}
                                            style={{ width: `${alt.features_match}%` }}
                                          />
                                        </div>
                                        <span className="font-bold">{alt.features_match}%</span>
                                      </div>
                                    </td>
                                    <td className="py-2.5 px-2">
                                      <span className={`font-bold ${Number(alt.savings_amount) > 0 ? 'text-[#5db872]' : 'text-muted'}`}>
                                        {Number(alt.savings_amount) > 0 ? `₹${Number(alt.savings_amount).toLocaleString()}` : '—'}
                                      </span>
                                    </td>
                                    <td className="py-2.5 px-2 text-muted max-w-[200px] truncate">{alt.recommendation}</td>
                                    <td className="py-2.5 px-2">
                                      {alt.source_url && (
                                        <a
                                          href={alt.source_url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="text-[#cc785c] hover:text-[#a9583e] cursor-pointer"
                                        >
                                          <ExternalLink className="w-3.5 h-3.5" />
                                        </a>
                                      )}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ===== FIND TOOL TAB ===== */}
        {activeTab === 'find' && (
          <div className="space-y-6">
            {/* Search Form */}
            <div className="bg-white border border-hairline rounded-2xl p-5 shadow-sm text-left">
              <h3 className="font-serif text-base font-normal text-ink mb-4">What do you need?</h3>
              <form onSubmit={handleFindTool} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-muted uppercase tracking-wider block">Describe your requirement</label>
                  <textarea
                    value={findRequirement}
                    onChange={e => setFindRequirement(e.target.value)}
                    placeholder="e.g. I need a CRM for managing 500+ leads with email automation, analytics dashboard, and WhatsApp integration. Must work well for Indian startups."
                    rows={4}
                    className="w-full bg-white border border-[#E5E0DA] text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-[#cc785c] resize-none leading-relaxed"
                    required
                  />
                </div>
                <div className="flex items-end gap-4">
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-muted uppercase tracking-wider block">Budget (₹/month)</label>
                    <input
                      type="number"
                      value={findBudget}
                      onChange={e => setFindBudget(e.target.value)}
                      placeholder="e.g. 5000"
                      className="w-48 bg-white border border-[#E5E0DA] text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-[#cc785c]"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={findLoading || !findRequirement}
                    className="flex items-center gap-1.5 px-5 py-2 bg-[#cc785c] hover:bg-[#a9583e] text-white rounded-lg text-xs font-bold transition-all shadow-2xs cursor-pointer disabled:opacity-50"
                  >
                    {findLoading ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        Researching...
                      </>
                    ) : (
                      <>
                        <Zap className="w-3.5 h-3.5" />
                        Find Best Option
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>

            {/* Research Results */}
            {requests.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-[10px] font-bold text-ink uppercase tracking-wider">Research History</h3>
                {requests.map(req => (
                  <div key={req.id} className="bg-white border border-hairline rounded-xl p-4 shadow-2xs text-left">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div>
                        <p className="text-sm font-semibold text-ink">{req.requirement}</p>
                        <div className="flex items-center gap-3 text-[10px] text-muted mt-1">
                          {req.budget && <span>Budget: ₹{Number(req.budget).toLocaleString()}</span>}
                          <span>{new Date(req.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                        </div>
                      </div>
                      <span className={`text-[9px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wide shrink-0 ${
                        req.status === 'complete' ? 'text-[#5db872] bg-[#5db872]/10 border border-[#5db872]/20' :
                        req.status === 'failed' ? 'text-[#c64545] bg-[#c64545]/10 border border-[#c64545]/20' :
                        'text-blue-700 bg-blue-50 border border-blue-200/50 animate-pulse'
                      }`}>
                        {req.status === 'researching' ? 'Researching...' : req.status}
                      </span>
                    </div>

                    {req.status === 'complete' && req.recommendation && (
                      <div className="mb-3 p-3 bg-[#5db872]/5 border border-[#5db872]/15 rounded-lg">
                        <p className="text-xs text-ink leading-relaxed">{req.recommendation}</p>
                      </div>
                    )}

                    {req.status === 'complete' && Array.isArray(req.top_picks) && req.top_picks.length > 0 && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {req.top_picks.map((pick: any, idx: number) => (
                          <div key={idx} className="border border-hairline rounded-lg p-3 bg-canvas hover:shadow-sm transition-shadow">
                            <div className="flex items-center justify-between mb-2">
                              <h5 className="text-xs font-bold text-ink">{pick.name}</h5>
                              {pick.fit_score && (
                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                                  pick.fit_score >= 80 ? 'text-[#5db872] bg-[#5db872]/10' :
                                  pick.fit_score >= 50 ? 'text-[#e8a55a] bg-[#e8a55a]/10' :
                                  'text-[#c64545] bg-[#c64545]/10'
                                }`}>
                                  {pick.fit_score}% fit
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] text-muted mb-2 leading-relaxed">{pick.description}</p>
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-ink">
                                {pick.currency || '₹'}{Number(pick.price || 0).toLocaleString()}/{pick.billing_cycle || 'mo'}
                              </span>
                              {pick.url && (
                                <a href={pick.url} target="_blank" rel="noopener noreferrer" className="text-[#cc785c] hover:text-[#a9583e]">
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ===== RENEWALS TAB ===== */}
        {activeTab === 'renewals' && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="font-serif text-base font-normal text-ink">Upcoming Renewals (14 days)</h3>
              <button
                onClick={handleCheckRenewals}
                disabled={renewalsLoading}
                className="flex items-center gap-1 text-[10px] font-bold text-[#cc785c] bg-[#cc785c]/10 border border-[#cc785c]/20 px-3 py-1.5 rounded-lg cursor-pointer hover:bg-[#cc785c]/20 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-3 h-3 ${renewalsLoading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>

            {renewalsLoading ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="w-5 h-5 text-[#cc785c] animate-spin" />
                <span className="text-xs text-muted-soft ml-2">Checking renewals...</span>
              </div>
            ) : renewals.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
                <CheckCircle2 className="w-10 h-10 text-[#5db872]" />
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-ink">All Clear!</h4>
                  <p className="text-xs text-muted-soft">No tools renewing in the next 14 days.</p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {renewals.map(alert => (
                  <div key={alert.item.id} className="bg-white border border-hairline rounded-xl p-4 shadow-2xs text-left">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="text-sm font-bold text-ink">{alert.item.name}</h4>
                          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                            alert.daysLeft <= 3
                              ? 'text-white bg-[#c64545]'
                              : alert.daysLeft <= 7
                              ? 'text-[#e8a55a] bg-[#e8a55a]/10 border border-[#e8a55a]/30'
                              : 'text-[#6b8fd4] bg-[#6b8fd4]/10 border border-[#6b8fd4]/30'
                          }`}>
                            {alert.daysLeft} day{alert.daysLeft !== 1 ? 's' : ''} left
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-[10px] text-muted">
                          <span>{alert.item.category}</span>
                          <span>₹{Number(alert.item.current_price || 0).toLocaleString()}/{alert.item.billing_cycle}</span>
                          <span>Renews: {new Date(alert.renewalDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                        </div>
                        {alert.bestAlternative && (
                          <div className="mt-2 p-2 bg-[#5db872]/5 border border-[#5db872]/15 rounded-lg text-[10px]">
                            <span className="font-bold text-[#5db872]">💡 Alternative:</span> {alert.bestAlternative.provider_name} — ₹{Number(alert.bestAlternative.price).toLocaleString()}/{alert.bestAlternative.billing_cycle} (Save ₹{Number(alert.potentialSavings).toLocaleString()})
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button className="text-[10px] font-bold text-[#5db872] bg-[#5db872]/10 border border-[#5db872]/20 px-3 py-1.5 rounded-lg cursor-pointer hover:bg-[#5db872]/20 transition-colors">
                          Renew
                        </button>
                        <button
                          onClick={() => handleFindAlternatives(alert.item.id)}
                          className="text-[10px] font-bold text-[#e8a55a] bg-[#e8a55a]/10 border border-[#e8a55a]/20 px-3 py-1.5 rounded-lg cursor-pointer hover:bg-[#e8a55a]/20 transition-colors"
                        >
                          Evaluate
                        </button>
                        <button className="text-[10px] font-bold text-[#c64545] bg-[#c64545]/10 border border-[#c64545]/20 px-3 py-1.5 rounded-lg cursor-pointer hover:bg-[#c64545]/20 transition-colors">
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ===== REPORT TAB ===== */}
        {activeTab === 'report' && (
          <div className="space-y-6">
            {!report ? (
              <div className="flex flex-col items-center justify-center py-16 text-center space-y-5">
                <div className="w-16 h-16 rounded-full bg-[#cc785c]/10 flex items-center justify-center border border-[#cc785c]/20">
                  <BarChart3 className="w-8 h-8 text-[#cc785c]" />
                </div>
                <div className="space-y-2">
                  <h2 className="font-serif text-xl text-ink font-normal">Stack Report</h2>
                  <p className="text-xs text-muted-soft leading-relaxed max-w-sm">
                    Generate an AI-powered analysis of your entire tool stack — find redundancies, cost optimization opportunities, and strategic recommendations.
                  </p>
                </div>
                <button
                  onClick={handleGenerateReport}
                  disabled={reportLoading || items.length === 0}
                  className="flex items-center gap-1.5 px-6 py-2.5 bg-[#cc785c] hover:bg-[#a9583e] text-white rounded-lg text-xs font-bold transition-all shadow-sm cursor-pointer disabled:opacity-50"
                >
                  {reportLoading ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      Generating Report...
                    </>
                  ) : (
                    <>
                      <Zap className="w-3.5 h-3.5" />
                      Generate Report
                    </>
                  )}
                </button>
                {items.length === 0 && (
                  <p className="text-[10px] text-muted-soft italic">Add tools in the Stack tab first.</p>
                )}
              </div>
            ) : (
              <div className="space-y-6">
                {/* Summary Row */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-white border border-hairline rounded-xl p-4 text-left">
                    <span className="text-[10px] font-bold text-muted uppercase tracking-wider">Monthly Spend</span>
                    <p className="text-lg font-bold text-ink mt-1">₹{report.totalMonthlySpend.toLocaleString()}</p>
                  </div>
                  <div className="bg-white border border-hairline rounded-xl p-4 text-left">
                    <span className="text-[10px] font-bold text-muted uppercase tracking-wider">Annual Spend</span>
                    <p className="text-lg font-bold text-ink mt-1">₹{report.totalAnnualSpend.toLocaleString()}</p>
                  </div>
                  <div className="bg-white border border-hairline rounded-xl p-4 text-left">
                    <span className="text-[10px] font-bold text-muted uppercase tracking-wider">Tools</span>
                    <p className="text-lg font-bold text-ink mt-1">{report.toolsCount}</p>
                  </div>
                  <div className="bg-white border border-hairline rounded-xl p-4 text-left">
                    <span className="text-[10px] font-bold text-muted uppercase tracking-wider">Potential Savings</span>
                    <p className="text-lg font-bold text-[#5db872] mt-1">₹{report.potentialSavings.toLocaleString()}</p>
                  </div>
                </div>

                {/* Donut Chart + Category Breakdown */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* CSS Donut Chart */}
                  <div className="bg-white border border-hairline rounded-2xl p-5 shadow-sm text-left">
                    <h4 className="text-[10px] font-bold text-ink uppercase tracking-wider mb-4">Spend by Category</h4>
                    <div className="flex items-center justify-center">
                      <div
                        className="w-48 h-48 rounded-full relative"
                        style={{ background: getDonutGradient(report.categoryBreakdown) }}
                      >
                        <div className="absolute inset-6 bg-white rounded-full flex items-center justify-center">
                          <div className="text-center">
                            <p className="text-lg font-bold text-ink">₹{report.totalMonthlySpend.toLocaleString()}</p>
                            <p className="text-[9px] text-muted">per month</p>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-2">
                      {report.categoryBreakdown.map((cat, i) => {
                        const colors = ['#cc785c', '#5db872', '#e8a55a', '#6b8fd4', '#c64545', '#9b72cf', '#4ec6c1', '#d4856b'];
                        return (
                          <div key={cat.category} className="flex items-center gap-2 text-[10px]">
                            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: colors[i % colors.length] }} />
                            <span className="text-muted truncate">{cat.category}</span>
                            <span className="font-bold text-ink ml-auto">{cat.percentage}%</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Cost Breakdown Table */}
                  <div className="bg-white border border-hairline rounded-2xl p-5 shadow-sm text-left">
                    <h4 className="text-[10px] font-bold text-ink uppercase tracking-wider mb-4">Cost Breakdown</h4>
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-hairline">
                          <th className="text-left py-2 text-[9px] font-bold text-muted uppercase tracking-wider">Category</th>
                          <th className="text-left py-2 text-[9px] font-bold text-muted uppercase tracking-wider">Tools</th>
                          <th className="text-left py-2 text-[9px] font-bold text-muted uppercase tracking-wider">Monthly</th>
                          <th className="text-left py-2 text-[9px] font-bold text-muted uppercase tracking-wider">Share</th>
                        </tr>
                      </thead>
                      <tbody>
                        {report.categoryBreakdown.map(cat => (
                          <tr key={cat.category} className="border-b border-hairline/50">
                            <td className="py-2.5 font-semibold text-ink">{cat.category}</td>
                            <td className="py-2.5 text-muted">{cat.count}</td>
                            <td className="py-2.5 text-ink">₹{Math.round(cat.monthlySpend).toLocaleString()}</td>
                            <td className="py-2.5 font-bold text-ink">{cat.percentage}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* AI Overview */}
                <div className="bg-white border border-hairline rounded-2xl p-5 shadow-sm text-left">
                  <h4 className="text-[10px] font-bold text-ink uppercase tracking-wider mb-3">AI Stack Overview</h4>
                  <p className="text-xs text-ink leading-relaxed whitespace-pre-line">{report.overview}</p>
                </div>

                {/* Redundancies */}
                {report.redundancies.length > 0 && (
                  <div className="bg-white border border-hairline rounded-2xl p-5 shadow-sm text-left">
                    <h4 className="text-[10px] font-bold text-ink uppercase tracking-wider mb-3 flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-[#e8a55a]" />
                      Redundancies Detected
                    </h4>
                    <div className="space-y-3">
                      {report.redundancies.map((r, i) => (
                        <div key={i} className="p-3 bg-[#e8a55a]/5 border border-[#e8a55a]/15 rounded-lg">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-bold text-ink">{r.tools.join(' + ')}</span>
                            <span className="text-[9px] text-muted bg-surface-soft px-1.5 py-0.5 rounded-full">{r.category}</span>
                          </div>
                          <p className="text-[10px] text-muted">{r.issue}</p>
                          <p className="text-[10px] text-[#5db872] font-semibold mt-1">💡 {r.suggestion}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Recommendations */}
                {report.recommendations.length > 0 && (
                  <div className="bg-white border border-hairline rounded-2xl p-5 shadow-sm text-left">
                    <h4 className="text-[10px] font-bold text-ink uppercase tracking-wider mb-3">Savings Opportunities</h4>
                    <div className="space-y-2">
                      {report.recommendations.map((rec, i) => (
                        <div key={i} className="flex items-start gap-3 p-3 rounded-lg hover:bg-surface-soft/30 transition-colors">
                          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full shrink-0 mt-0.5 ${
                            rec.priority === 'high' ? 'text-[#c64545] bg-[#c64545]/10' :
                            rec.priority === 'medium' ? 'text-[#e8a55a] bg-[#e8a55a]/10' :
                            'text-[#6b8fd4] bg-[#6b8fd4]/10'
                          }`}>
                            {rec.priority}
                          </span>
                          <div>
                            <h5 className="text-xs font-bold text-ink">{rec.title}</h5>
                            <p className="text-[10px] text-muted mt-0.5 leading-relaxed">{rec.description}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Regenerate */}
                <div className="flex justify-center">
                  <button
                    onClick={handleGenerateReport}
                    disabled={reportLoading}
                    className="flex items-center gap-1 text-[10px] font-bold text-muted hover:text-ink cursor-pointer transition-colors disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3 h-3 ${reportLoading ? 'animate-spin' : ''}`} />
                    Regenerate Report
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Stream Logs */}
        <div className="mt-8 border-t border-hairline pt-6 shrink-0 text-left">
          <h3 className="text-xs font-bold uppercase tracking-wider text-ink mb-3">Procurement Agent Live Stream</h3>
          <LiveFeed
            projectId={projectId}
            filterTypes={[
              StreamEventType.AGENT_STARTED,
              StreamEventType.AGENT_THINKING,
              StreamEventType.AGENT_COMPLETE,
              StreamEventType.TOOL_CALLING,
              StreamEventType.STREAM_ERROR
            ]}
            maxHeight="150px"
            compact={true}
          />
        </div>
      </div>
    </div>
  );
}
