'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Zap, 
  ArrowRight, 
  Database, 
  Scale, 
  ThumbsUp, 
  Bot, 
  LayoutGrid, 
  Brain, 
  Plug, 
  ChevronRight, 
  Menu, 
  X, 
  Terminal, 
  Code,
  Shield,
  Layers,
  Sparkles
} from 'lucide-react';

const CONNECTOR_CODE = `import { MCPClient } from '@modelcontextprotocol/sdk';

// Initialize Notion Database Connector
const mcpRegistry = new MCPClient({
  name: 'Notion Database',
  version: '1.2.0',
  transport: 'sse',
  endpoint: process.env.NOTION_MCP_SERVER_URL,
});

export async function executeConnectedTool(
  toolName: string, 
  args: Record<string, any>
) {
  // Credentials decrypted securely via AES-256
  const activeSession = await mcpRegistry.connect();
  const result = await activeSession.callTool(toolName, args);
  return result;
}`;

const COUNCIL_CODE = `{
  "project_id": "f8ac6b10-2da6-4373-be86-06dbadbd266f",
  "topic": "Frontend Performance Optimization Strategy",
  "quorum": 3,
  "voters": [
    { "agent": "FeatureHarmonizer", "vote": "reject", "reason": "Bundle size exceeds 250kb threshold" },
    { "agent": "StrategyValidator", "vote": "approve", "reason": "Lazy loading covers the main bundle gap" },
    { "agent": "Verdict", "vote": "approve", "reason": "Approved contingent on route-split logic" }
  ],
  "status": "APPROVED_WITH_CONDITIONS"
}`;

const CANVAS_CODE = `{
  "canvas_name": "SaaS Competitor Analysis India 2026",
  "rows_target": 10,
  "schema": [
    { "name": "Company", "type": "text" },
    { "name": "Segment", "type": "category" },
    { "name": "EstRevenue", "type": "currency" },
    { "name": "FundingStage", "type": "text" }
  ],
  "rows": [
    { "Company": "GrowX", "Segment": "HR-Tech", "EstRevenue": "$4.2M", "FundingStage": "Series A" },
    { "Company": "Keka", "Segment": "Payroll", "EstRevenue": "$18.5M", "FundingStage": "Post-Series B" }
  ]
}`;

export default function LandingPage() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'connectors' | 'council' | 'canvas'>('connectors');

  return (
    <div className="min-h-screen bg-canvas text-ink font-dmsans overflow-x-hidden selection:bg-primary/25 selection:text-ink">
      {/* 1. TOP NAVIGATION */}
      <header className="h-16 border-b border-hairline bg-canvas/90 backdrop-blur-md sticky top-0 z-50 flex items-center justify-between px-6 md:px-12 select-none">
        <div className="flex items-center gap-6">
          {/* Brand Logo & Wordmark */}
          <Link href="/" className="flex items-center gap-2.5 group">
            {/* Anthropic-like radial spike mark */}
            <div className="relative w-5 h-5 text-primary shrink-0 transition-transform duration-300 group-hover:rotate-45">
              <svg className="w-full h-full" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="12" cy="12" r="2.5" />
                <path d="M12 1.5a1 1 0 011 1v3a1 1 0 11-2 0v-3a1 1 0 011-1zm0 15a1 1 0 011 1v3a1 1 0 11-2 0v-3a1 1 0 011-1zM1.5 12a1 1 0 011-1h3a1 1 0 110 2h-3a1 1 0 01-1-1zm15 0a1 1 0 011-1h3a1 1 0 110 2h-3a1 1 0 01-1-1z" />
              </svg>
            </div>
            <span className="font-lora text-xl font-normal text-ink tracking-tight">
              3RDMIND
            </span>
          </Link>

          {/* Desktop Nav Items */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-muted">
            <a href="#features" className="hover:text-ink transition-colors">Platform</a>
            <a href="#connectors" className="hover:text-ink transition-colors">Connectors</a>
            <a href="#pricing" className="hover:text-ink transition-colors">Pricing</a>
            <a href="https://github.com/saivarshithnaidu/3rdmindai" target="_blank" rel="noopener noreferrer" className="hover:text-ink transition-colors">Docs</a>
          </nav>
        </div>

        {/* Right Nav Buttons */}
        <div className="hidden md:flex items-center gap-4">
          <Link href="/workspace" className="text-sm font-medium hover:text-primary transition-colors px-3 py-1.5">
            Sign in
          </Link>
          <Link 
            href="/workspace" 
            className="bg-primary hover:bg-primary-active text-on-primary text-sm font-medium px-4 py-2 rounded-md shadow-2xs hover:shadow-xs transition-all duration-150 flex items-center gap-1.5"
          >
            <span>Try 3RDMIND</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* Mobile Menu Toggle */}
        <button 
          type="button"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="md:hidden p-1.5 hover:bg-surface-soft rounded-lg text-muted hover:text-ink transition-colors cursor-pointer"
        >
          {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </header>

      {/* Mobile Navigation Panel */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div 
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
            className="md:hidden border-b border-hairline bg-canvas w-full px-6 py-4 flex flex-col gap-4 absolute top-16 left-0 z-40 shadow-xs"
          >
            <a href="#features" onClick={() => setIsMobileMenuOpen(false)} className="text-sm font-semibold text-muted hover:text-ink transition-colors py-1">Platform</a>
            <a href="#connectors" onClick={() => setIsMobileMenuOpen(false)} className="text-sm font-semibold text-muted hover:text-ink transition-colors py-1">Connectors</a>
            <a href="#pricing" onClick={() => setIsMobileMenuOpen(false)} className="text-sm font-semibold text-muted hover:text-ink transition-colors py-1">Pricing</a>
            <Link href="/workspace" onClick={() => setIsMobileMenuOpen(false)} className="text-sm font-semibold text-muted hover:text-ink transition-colors py-1">Sign in</Link>
            <Link 
              href="/workspace"
              onClick={() => setIsMobileMenuOpen(false)}
              className="bg-primary hover:bg-primary-active text-on-primary text-sm font-semibold py-2.5 px-4 rounded-md text-center shadow-xs transition-colors flex items-center justify-center gap-1.5"
            >
              <span>Try 3RDMIND</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 2. HERO SECTION */}
      <section className="py-16 md:py-24 px-6 md:px-12 max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
        {/* Left column text */}
        <div className="space-y-6 max-w-xl">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 text-primary text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full">
            <Plug className="w-3 h-3" />
            <span>MCP Connectors now live</span>
          </div>

          {/* Heading */}
          <h1 className="font-lora text-4xl md:text-5xl lg:text-[54px] font-normal leading-[1.08] text-ink tracking-tight">
            Meet your thinking partner. The intelligence above intelligence.
          </h1>

          {/* Paragraph */}
          <p className="text-body text-base md:text-lg font-normal leading-relaxed">
            3RDMIND is a warm, editorial workspace designed to coordinate and orchestrate teams of expert AI agents. Solve complex technical workflows with integrated tools and real-time execution.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 pt-2">
            <Link 
              href="/workspace" 
              className="bg-primary hover:bg-primary-active text-on-primary text-center font-medium px-6 py-3 rounded-md shadow-xs hover:shadow-sm transition-all duration-150 flex items-center justify-center gap-2"
            >
              <span>Try 3RDMIND for free</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
            <a 
              href="#features" 
              className="border border-hairline hover:border-primary/40 bg-canvas hover:bg-surface-soft text-ink text-center font-medium px-6 py-3 rounded-md shadow-2xs transition-colors flex items-center justify-center gap-1.5"
            >
              <span>Explore Platform</span>
            </a>
          </div>
        </div>

        {/* Right column: Simulated UI Mockup */}
        <div className="relative select-none">
          <div className="absolute inset-0 bg-primary/5 rounded-2xl blur-3xl -z-10" />
          
          {/* Product card mockup container */}
          <div className="bg-surface-dark border border-surface-dark-elevated rounded-xl shadow-lg overflow-hidden w-full font-mono text-[11px] text-on-dark animate-slideUp">
            {/* Header bar */}
            <div className="flex items-center justify-between px-4 py-3 bg-surface-dark-elevated border-b border-surface-dark/40 text-[10px] text-on-dark-soft">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
                <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/80" />
                <span className="w-2.5 h-2.5 rounded-full bg-green-500/80" />
                <span className="ml-2 font-semibold tracking-wider text-[9px] uppercase">Process and analyze the resume...</span>
              </div>
              <span className="bg-[#EBE5DC]/10 text-on-dark-soft border border-hairline/10 font-bold px-2 py-0.5 rounded text-[8px] uppercase tracking-wider">
                Root Orchestrator
              </span>
            </div>

            {/* Simulated Chat & Agent Workflow */}
            <div className="p-5 space-y-4">
              {/* Agent Spawned Header */}
              <div className="flex items-center justify-between border-b border-surface-dark-elevated pb-2">
                <span className="text-[10px] text-accent-teal font-bold uppercase tracking-wider">Spawned Workflow</span>
                <span className="text-on-dark-soft text-[9px]">4 sub-agents active</span>
              </div>

              {/* Spawned Sub-agents nodes */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
                <div className="bg-surface-dark-elevated p-2 rounded border border-hairline/10 flex flex-col justify-between h-14">
                  <span className="text-[9px] text-on-dark font-bold leading-none">FeatureHarmonizer</span>
                  <span className="text-[8px] text-red-400 font-semibold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                    Error
                  </span>
                </div>
                <div className="bg-surface-dark-elevated p-2 rounded border border-hairline/10 flex flex-col justify-between h-14">
                  <span className="text-[9px] text-on-dark font-bold leading-none">DebateModerator</span>
                  <span className="text-[8px] text-red-400 font-semibold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                    Error
                  </span>
                </div>
                <div className="bg-surface-dark-elevated p-2 rounded border border-hairline/10 flex flex-col justify-between h-14">
                  <span className="text-[9px] text-on-dark font-bold leading-none">StrategyValidator</span>
                  <span className="text-[8px] text-emerald-400 font-semibold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    Done
                  </span>
                </div>
                <div className="bg-surface-dark-elevated p-2 rounded border border-hairline/10 flex flex-col justify-between h-14">
                  <span className="text-[9px] text-on-dark font-bold leading-none">Verdict</span>
                  <span className="text-[8px] text-blue-400 font-semibold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                    Running
                  </span>
                </div>
              </div>

              {/* Message Bubble Preview */}
              <div className="bg-surface-dark-soft border border-surface-dark-elevated p-4 rounded-lg space-y-2">
                <span className="text-[10px] font-bold text-primary tracking-wider uppercase">Verdict response (compiling...)</span>
                <p className="text-[11px] text-on-dark-soft leading-relaxed font-lora text-sm">
                  5. Sample Customized Resume for "AI Backend Engineer" Role
                </p>
                <div className="text-[10px] text-on-dark-soft space-y-1 pl-2.5 border-l border-primary/45 font-dmsans">
                  <p>• Built low-latency LLM orchestration layer serving 3k+ RPM</p>
                  <p>• Reduced inference costs 40% via dynamic model routing</p>
                  <p>• Implemented OAuth 2.0 + rate limiting (5req/sec/IP)</p>
                </div>
              </div>

              {/* Status bar */}
              <div className="flex items-center justify-between text-[9px] text-on-dark-soft border-t border-surface-dark-elevated pt-3 mt-1">
                <span className="flex items-center gap-1.5">
                  <Terminal className="w-3.5 h-3.5 text-accent-teal" />
                  <span>3RDMIND has compiled 17 sub-agent verdicts in 32.4s</span>
                </span>
                <span className="text-primary font-bold">100% completed</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. PLATFORM FEATURES SECTION */}
      <section id="features" className="py-24 bg-surface-soft border-t border-b border-hairline px-6 md:px-12 scroll-mt-16">
        <div className="max-w-7xl mx-auto space-y-16">
          {/* Section Header */}
          <div className="text-center space-y-3 max-w-2xl mx-auto">
            <h2 className="font-lora text-3xl md:text-4xl font-normal text-ink tracking-tight">
              A new standard for multi-agent workflows.
            </h2>
            <p className="text-muted text-sm md:text-base leading-relaxed">
              Designed for clarity, focus, and technical depth. Bring structure, evaluation, and tools to autonomous execution.
            </p>
          </div>

          {/* 3-Up Feature Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Card 1 */}
            <div className="bg-surface-card border border-hairline rounded-lg p-8 flex flex-col justify-between min-h-[280px] shadow-2xs">
              <div className="space-y-4">
                <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                  <Brain className="w-5 h-5" />
                </div>
                <h3 className="font-lora text-xl font-normal text-ink tracking-tight">
                  Multi-Agent Councils
                </h3>
                <p className="text-body text-xs md:text-sm leading-relaxed">
                  Spawn multiple expert personas to collaboratively solve complex tasks. Agents automatically debate, validate, and check each other's output, filtering errors before delivering a unified consensus.
                </p>
              </div>
              <div className="pt-6">
                <Link href="/workspace" className="text-xs font-semibold text-primary hover:text-primary-active flex items-center gap-1">
                  <span>Open council workspace</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>

            {/* Card 2 */}
            <div className="bg-surface-card border border-hairline rounded-lg p-8 flex flex-col justify-between min-h-[280px] shadow-2xs">
              <div className="space-y-4">
                <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                  <Database className="w-5 h-5" />
                </div>
                <h3 className="font-lora text-xl font-normal text-ink tracking-tight">
                  Live Data Canvas
                </h3>
                <p className="text-body text-xs md:text-sm leading-relaxed">
                  Research and compile complex query answers dynamically. Live Data Canvas builds structural tables from web searches, databases, and spreadsheets in your side panel, maintaining real-time progress bars.
                </p>
              </div>
              <div className="pt-6">
                <Link href="/workspace" className="text-xs font-semibold text-primary hover:text-primary-active flex items-center gap-1">
                  <span>View data canvas demos</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>

            {/* Card 3 */}
            <div className="bg-surface-card border border-hairline rounded-lg p-8 flex flex-col justify-between min-h-[280px] shadow-2xs">
              <div className="space-y-4">
                <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                  <LayoutGrid className="w-5 h-5" />
                </div>
                <h3 className="font-lora text-xl font-normal text-ink tracking-tight">
                  Interactive Sandbox
                </h3>
                <p className="text-body text-xs md:text-sm leading-relaxed">
                  Preview, inspect, and modify visual HTML/CSS output in real-time. Toggle side-by-side splits directly, print to high-fidelity vector PDF, or download output code instantly. No configurations required.
                </p>
              </div>
              <div className="pt-6">
                <Link href="/workspace" className="text-xs font-semibold text-primary hover:text-primary-active flex items-center gap-1">
                  <span>Launch component sandbox</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. TECHNICAL SHOWCASE / CONNECTORS (Alternating Dark Navy Surface) */}
      <section id="connectors" className="py-24 bg-surface-dark text-on-dark px-6 md:px-12 scroll-mt-16">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          {/* Code Window Mockup */}
          <div className="order-2 lg:order-1 font-mono text-[11px] overflow-hidden rounded-lg border border-surface-dark-elevated shadow-md select-none animate-fadeIn w-full">
            {/* Interactive Tabs bar */}
            <div className="flex border-b border-surface-dark-elevated bg-surface-dark-soft text-[10px] text-on-dark-soft select-none">
              <button 
                type="button"
                onClick={() => setActiveTab('connectors')}
                className={`px-4 py-2.5 font-bold cursor-pointer transition-colors border-r border-surface-dark-elevated ${
                  activeTab === 'connectors' 
                    ? 'bg-surface-dark text-on-dark border-t-2 border-t-primary' 
                    : 'hover:text-on-dark hover:bg-surface-dark/50'
                }`}
              >
                mcp-connector.ts
              </button>
              <button 
                type="button"
                onClick={() => setActiveTab('council')}
                className={`px-4 py-2.5 font-bold cursor-pointer transition-colors border-r border-surface-dark-elevated ${
                  activeTab === 'council' 
                    ? 'bg-surface-dark text-on-dark border-t-2 border-t-primary' 
                    : 'hover:text-on-dark hover:bg-surface-dark/50'
                }`}
              >
                agent-council.json
              </button>
              <button 
                type="button"
                onClick={() => setActiveTab('canvas')}
                className={`px-4 py-2.5 font-bold cursor-pointer transition-colors border-r border-surface-dark-elevated ${
                  activeTab === 'canvas' 
                    ? 'bg-surface-dark text-on-dark border-t-2 border-t-primary' 
                    : 'hover:text-on-dark hover:bg-surface-dark/50'
                }`}
              >
                live-data-canvas.json
              </button>
            </div>

            {/* Header / Sub-tab info bar */}
            <div className="flex items-center justify-between px-4 py-2 bg-surface-dark-elevated border-b border-surface-dark/20 text-[9px] text-on-dark-soft">
              <div className="flex items-center gap-1.5 font-semibold">
                <Code className="w-3.5 h-3.5 text-accent-teal" />
                <span>
                  {activeTab === 'connectors' && 'Notion Connector Code'}
                  {activeTab === 'council' && 'Sub-Agent Verdict Output'}
                  {activeTab === 'canvas' && 'Ag-Grid Dynamic Row Records'}
                </span>
              </div>
              <span className="text-emerald-400 font-bold uppercase text-[8px] px-2 py-0.5 rounded bg-emerald-500/10">Active</span>
            </div>

            {/* Code lines */}
            <pre className="p-4 overflow-x-auto text-[11px] text-on-dark bg-surface-dark-soft leading-relaxed min-h-[300px] max-h-[400px]">
              <code>
                {activeTab === 'connectors' && CONNECTOR_CODE}
                {activeTab === 'council' && COUNCIL_CODE}
                {activeTab === 'canvas' && CANVAS_CODE}
              </code>
            </pre>
          </div>

          {/* Text content */}
          <div className="space-y-6 order-1 lg:order-2 max-w-xl">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 bg-[#EBE5DC]/10 border border-hairline/10 text-on-dark text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full">
              <Zap className="w-3 h-3 text-primary" />
              <span>Unified MCP protocol</span>
            </div>

            {/* Heading */}
            <h2 className="font-lora text-3xl md:text-4xl font-normal leading-[1.15] text-on-dark tracking-tight">
              Connect tools once. All agents run them autonomously.
            </h2>

            {/* Paragraphs */}
            <p className="text-on-dark-soft text-sm md:text-base leading-relaxed">
              3RDMIND integrates the Model Context Protocol (MCP) to let your AI agents browse repositories, search databases, sync documents, or edit files. 
            </p>
            
            <p className="text-on-dark-soft text-sm md:text-base leading-relaxed">
              Decrypt credentials securely at runtime via AES-256 encryption. Let the orchestrator choose when to consult external databases and tools, displaying trace logs transparently in the chat bubble accordions.
            </p>

            {/* Icons row */}
            <div className="flex items-center gap-6 pt-4 text-on-dark-soft border-t border-surface-dark-elevated">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-accent-teal" />
                <span className="text-[10px] font-bold uppercase tracking-wider">AES-256 Encrypted</span>
              </div>
              <div className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-primary" />
                <span className="text-[10px] font-bold uppercase tracking-wider">Trace Audits</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 5. AGENT SYSTEM MODEL COMPARISON */}
      <section className="py-24 px-6 md:px-12 max-w-7xl mx-auto space-y-16">
        {/* Section Header */}
        <div className="text-center space-y-3 max-w-2xl mx-auto">
          <h2 className="font-lora text-3xl md:text-4xl font-normal text-ink tracking-tight">
            Designed for execution rigor.
          </h2>
          <p className="text-muted text-sm md:text-base leading-relaxed">
            The 3RDMIND pipeline separates responsibilities into specialized agent layers, running in parallel to guarantee analytical depth.
          </p>
        </div>

        {/* Comparison grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          <div className="border border-hairline bg-canvas rounded-lg p-6 space-y-4">
            <span className="text-[10px] bg-[#EBE5DC]/55 text-muted border border-hairline/70 font-mono font-bold uppercase px-2 py-0.5 rounded">
              L1 Dispatcher
            </span>
            <h3 className="font-lora text-lg font-normal text-ink">Root Orchestrator</h3>
            <p className="text-body text-xs leading-relaxed">
              Consumes initial goals, gathers files, and builds the strategic outline. Dynamically spawns task-specific sub-agents and assigns them tools.
            </p>
          </div>

          <div className="border border-hairline bg-canvas rounded-lg p-6 space-y-4">
            <span className="text-[10px] bg-[#EBE5DC]/55 text-muted border border-hairline/70 font-mono font-bold uppercase px-2 py-0.5 rounded">
              L2 Evaluator
            </span>
            <h3 className="font-lora text-lg font-normal text-ink">Strategy Validator</h3>
            <p className="text-body text-xs leading-relaxed">
              Reviews sub-agent plans, checks against design files, flags missing constraints, and forces iterative corrections before execution begins.
            </p>
          </div>

          <div className="border border-hairline bg-canvas rounded-lg p-6 space-y-4">
            <span className="text-[10px] bg-[#EBE5DC]/55 text-muted border border-hairline/70 font-mono font-bold uppercase px-2 py-0.5 rounded">
              L3 Arbiter
            </span>
            <h3 className="font-lora text-lg font-normal text-ink">Final Verdict</h3>
            <p className="text-body text-xs leading-relaxed">
              Reviews execution logs, checks syntax compliance, resolves consensus debates, and compiles the final result into structural files.
            </p>
          </div>
        </div>
      </section>

      {/* 6. PRICING SECTION */}
      <section id="pricing" className="py-24 bg-surface-soft border-t border-b border-hairline px-6 md:px-12 scroll-mt-16">
        <div className="max-w-7xl mx-auto space-y-16">
          {/* Section Header */}
          <div className="text-center space-y-3 max-w-2xl mx-auto">
            <h2 className="font-lora text-3xl md:text-4xl font-normal text-ink tracking-tight">
              Pricing designed to scale.
            </h2>
            <p className="text-muted text-sm md:text-base leading-relaxed">
              Access workspace tools with complete cost transparency. Start building councils for free.
            </p>
          </div>

          {/* Pricing Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto items-stretch">
            {/* Tier 1 */}
            <div className="bg-canvas border border-hairline rounded-lg p-8 flex flex-col justify-between shadow-2xs">
              <div className="space-y-6">
                <div>
                  <h3 className="text-base font-semibold text-muted tracking-wide uppercase">Free</h3>
                  <div className="mt-4 flex items-baseline text-ink">
                    <span className="font-lora text-4xl font-normal tracking-tight">$0</span>
                    <span className="ml-1 text-sm font-medium text-muted">/month</span>
                  </div>
                  <p className="mt-3 text-xs text-muted">For individuals exploring multi-agent workflows.</p>
                </div>
                
                <ul className="space-y-3.5 border-t border-hairline pt-6 text-xs text-body">
                  <li className="flex items-center gap-2">
                    <ThumbsUp className="w-3.5 h-3.5 text-primary shrink-0" />
                    <span>3 active project workspaces</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <ThumbsUp className="w-3.5 h-3.5 text-primary shrink-0" />
                    <span>Shared orchestrator model</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <ThumbsUp className="w-3.5 h-3.5 text-primary shrink-0" />
                    <span>Base tool integrations</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <ThumbsUp className="w-3.5 h-3.5 text-primary shrink-0" />
                    <span>Markdown exports only</span>
                  </li>
                </ul>
              </div>

              <div className="pt-8">
                <Link 
                  href="/workspace" 
                  className="w-full text-center border border-hairline hover:border-primary/45 bg-canvas hover:bg-surface-soft text-ink font-medium px-4 py-2.5 rounded-md inline-block transition-colors text-xs"
                >
                  Get started
                </Link>
              </div>
            </div>

            {/* Tier 2 (FEATURED: Dark surface card) */}
            <div className="bg-surface-dark text-on-dark rounded-lg p-8 flex flex-col justify-between shadow-md relative scale-105 border border-primary/30">
              <div className="absolute top-0 right-6 -translate-y-1/2 bg-primary text-on-primary text-[8px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full">
                Most Popular
              </div>

              <div className="space-y-6">
                <div>
                  <h3 className="text-base font-semibold text-primary tracking-wide uppercase">Pro</h3>
                  <div className="mt-4 flex items-baseline text-on-dark">
                    <span className="font-lora text-4xl font-normal tracking-tight">$20</span>
                    <span className="ml-1 text-sm font-medium text-on-dark-soft">/month</span>
                  </div>
                  <p className="mt-3 text-xs text-on-dark-soft">For power developers requiring rigorous analysis.</p>
                </div>
                
                <ul className="space-y-3.5 border-t border-surface-dark-elevated pt-6 text-xs text-on-dark-soft">
                  <li className="flex items-center gap-2">
                    <ThumbsUp className="w-3.5 h-3.5 text-primary shrink-0" />
                    <span className="text-on-dark">Unlimited project workspaces</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <ThumbsUp className="w-3.5 h-3.5 text-primary shrink-0" />
                    <span className="text-on-dark">Advanced custom sub-agent models</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <ThumbsUp className="w-3.5 h-3.5 text-primary shrink-0" />
                    <span className="text-on-dark">Full-speed MCP connector servers</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <ThumbsUp className="w-3.5 h-3.5 text-primary shrink-0" />
                    <span className="text-on-dark">Vector PDF & HTML code exports</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <ThumbsUp className="w-3.5 h-3.5 text-primary shrink-0" />
                    <span className="text-on-dark">Priority scheduling support</span>
                  </li>
                </ul>
              </div>

              <div className="pt-8">
                <Link 
                  href="/workspace" 
                  className="w-full text-center bg-primary hover:bg-primary-active text-on-primary font-medium px-4 py-2.5 rounded-md inline-block transition-colors text-xs shadow-xs"
                >
                  Upgrade to Pro
                </Link>
              </div>
            </div>

            {/* Tier 3 */}
            <div className="bg-canvas border border-hairline rounded-lg p-8 flex flex-col justify-between shadow-2xs">
              <div className="space-y-6">
                <div>
                  <h3 className="text-base font-semibold text-muted tracking-wide uppercase">Enterprise</h3>
                  <div className="mt-4 flex items-baseline text-ink">
                    <span className="font-lora text-4xl font-normal tracking-tight">Custom</span>
                  </div>
                  <p className="mt-3 text-xs text-muted">For organizations requiring isolated execution.</p>
                </div>
                
                <ul className="space-y-3.5 border-t border-hairline pt-6 text-xs text-body">
                  <li className="flex items-center gap-2">
                    <ThumbsUp className="w-3.5 h-3.5 text-primary shrink-0" />
                    <span>Isolated dedicated servers</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <ThumbsUp className="w-3.5 h-3.5 text-primary shrink-0" />
                    <span>Private custom MCP network mapping</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <ThumbsUp className="w-3.5 h-3.5 text-primary shrink-0" />
                    <span>Single Sign-On (SSO) & audit logs</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <ThumbsUp className="w-3.5 h-3.5 text-primary shrink-0" />
                    <span>Custom SLA & account representative</span>
                  </li>
                </ul>
              </div>

              <div className="pt-8">
                <Link 
                  href="/workspace" 
                  className="w-full text-center border border-hairline hover:border-primary/45 bg-canvas hover:bg-surface-soft text-ink font-medium px-4 py-2.5 rounded-md inline-block transition-colors text-xs"
                >
                  Contact sales
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 7. FULL-BLEED CORAL CALLOUT CARD */}
      <section className="px-6 md:px-12 py-16 max-w-7xl mx-auto">
        <div className="bg-primary text-on-primary rounded-xl p-8 md:p-12 text-center space-y-6 shadow-md relative overflow-hidden">
          {/* Subtle logo in bg */}
          <div className="absolute -right-10 -bottom-10 opacity-5 text-white pointer-events-none select-none">
            <svg className="w-80 h-80" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 1.5a1 1 0 011 1v3a1 1 0 11-2 0v-3a1 1 0 011-1zm0 15a1 1 0 011 1v3a1 1 0 11-2 0v-3a1 1 0 011-1z" />
            </svg>
          </div>

          <h2 className="font-lora text-3xl md:text-4xl font-normal tracking-tight text-on-primary max-w-2xl mx-auto leading-tight">
            Assemble your first agent council today.
          </h2>
          <p className="text-on-primary/80 max-w-xl mx-auto text-sm leading-relaxed font-dmsans">
            Accelerate your engineering decisions. Orchestrate tasks, write code, run live diagnostics, and merge expert inputs in a warm, distraction-free environment.
          </p>
          <div className="pt-4">
            <Link 
              href="/workspace" 
              className="bg-canvas hover:bg-surface-soft text-ink hover:text-primary font-medium px-8 py-3.5 rounded-md inline-block shadow-sm hover:shadow transition-all duration-150 text-sm"
            >
              Start Building Now
            </Link>
          </div>
        </div>
      </section>

      {/* 8. FOOTER */}
      <footer className="bg-surface-dark text-on-dark-soft py-16 px-6 md:px-12 border-t border-surface-dark-elevated">
        <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-5 gap-10">
          {/* Logo column */}
          <div className="col-span-2 space-y-4">
            <Link href="/" className="flex items-center gap-2 text-on-dark group">
              <div className="w-5 h-5 text-primary shrink-0 transition-transform duration-300 group-hover:rotate-45">
                <svg className="w-full h-full" viewBox="0 0 24 24" fill="currentColor">
                  <circle cx="12" cy="12" r="2.5" />
                  <path d="M12 1.5a1 1 0 011 1v3a1 1 0 11-2 0v-3a1 1 0 011-1zm0 15a1 1 0 011 1v3a1 1 0 11-2 0v-3a1 1 0 011-1z" />
                </svg>
              </div>
              <span className="font-lora text-xl font-normal tracking-tight">
                3RDMIND
              </span>
            </Link>
            <p className="text-xs leading-relaxed max-w-xs">
              The first mind is human. The second mind is a single AI. The third mind is the orchestrator — the intelligence that coordinates intelligence.
            </p>
            <p className="text-[10px] text-on-dark-soft pt-2">
              © {new Date().getFullYear()} 3RDMIND Inc. All rights reserved.
            </p>
          </div>

          {/* Links Column 1 */}
          <div className="space-y-4">
            <h4 className="text-[10px] font-bold text-on-dark uppercase tracking-wider">Product</h4>
            <div className="flex flex-col gap-2.5 text-xs">
              <a href="#features" className="hover:text-on-dark transition-colors">Platform</a>
              <a href="#connectors" className="hover:text-on-dark transition-colors">MCP Connectors</a>
              <a href="#pricing" className="hover:text-on-dark transition-colors">Pricing Structure</a>
              <Link href="/workspace" className="hover:text-on-dark transition-colors">Developer Portal</Link>
            </div>
          </div>

          {/* Links Column 2 */}
          <div className="space-y-4">
            <h4 className="text-[10px] font-bold text-on-dark uppercase tracking-wider">Resources</h4>
            <div className="flex flex-col gap-2.5 text-xs">
              <a href="https://github.com/saivarshithnaidu/3rdmindai" target="_blank" rel="noopener noreferrer" className="hover:text-on-dark transition-colors">Documentation</a>
              <a href="#" className="hover:text-on-dark transition-colors">API Reference</a>
              <a href="#" className="hover:text-on-dark transition-colors">Release Notes</a>
              <a href="#" className="hover:text-on-dark transition-colors">System Status</a>
            </div>
          </div>

          {/* Links Column 3 */}
          <div className="space-y-4">
            <h4 className="text-[10px] font-bold text-on-dark uppercase tracking-wider">Legal</h4>
            <div className="flex flex-col gap-2.5 text-xs">
              <a href="#" className="hover:text-on-dark transition-colors">Privacy Policy</a>
              <a href="#" className="hover:text-on-dark transition-colors">Terms of Service</a>
              <a href="#" className="hover:text-on-dark transition-colors">Security Audit</a>
              <a href="#" className="hover:text-on-dark transition-colors">GDPR / CCPA</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
