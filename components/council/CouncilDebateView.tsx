import React, { useState, useEffect } from 'react';
import { Agent, Message } from '../../types';
import { supabaseService } from '../../services/supabase.service';
import { 
  ArrowRight, 
  Loader2, 
  MessageSquare, 
  Check, 
  Copy, 
  Maximize2, 
  X, 
  ShieldAlert, 
  AlertCircle,
  TrendingUp,
  BrainCircuit,
  ThumbsUp,
  Scale,
  Minus,
  LayoutGrid,
  BarChart3,
  FileText
} from 'lucide-react';

interface CouncilDebateViewProps {
  agents: Agent[];
  projectId: string;
}

export default function CouncilDebateView({ agents, projectId }: CouncilDebateViewProps) {
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [fullMessage, setFullMessage] = useState<string | null>(null);
  const [isLoadingMessage, setIsLoadingMessage] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Sub-tabs: 'matrix' | 'verdict' | 'chart'
  const [activeSubTab, setActiveSubTab] = useState<'matrix' | 'verdict' | 'chart'>('matrix');
  const [matrixData, setMatrixData] = useState<any>(null);
  const [dbMatrixNeedsMigration, setDbMatrixNeedsMigration] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);

  // 1. Find the council manager agent
  const councilManager = agents.find(a => 
    a.name.toLowerCase().includes('council') || 
    a.task?.toLowerCase().includes('council') ||
    a.task?.toLowerCase().includes('debate')
  );

  // 2. Filter child agents of the council manager (exclude ClaimExtractor from timeline cards if desired, but keep Verdict)
  const councilSeats = councilManager 
    ? agents.filter(a => a.parent_agent_id === councilManager.id && a.name !== 'ClaimExtractor')
    : [];

  const getSeatOrder = (agent: Agent) => {
    const name = agent.name.toLowerCase();
    const role = agent.role.toLowerCase();
    
    if (name.includes('creative') || role.includes('creative')) return 1;
    if (name.includes('critic') || role.includes('critic')) return 2;
    if (name.includes('auditor') || role.includes('auditor')) return 3;
    if (name.includes('general') || role.includes('general')) return 4;
    if (name.includes('verdict') || role.includes('verdict')) return 100;
    return 5;
  };

  const sortedSeats = [...councilSeats].sort((a, b) => {
    const orderA = getSeatOrder(a);
    const orderB = getSeatOrder(b);
    if (orderA !== orderB) return orderA - orderB;
    
    const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
    const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
    return timeA - timeB;
  });

  // Fetch Matrix data from database in real-time
  useEffect(() => {
    if (!councilManager) return;
    
    const fetchMatrix = async () => {
      try {
        const supabase = supabaseService.getClient();
        const { data, error } = await supabase
          .from('council_matrix')
          .select('*')
          .eq('manager_id', councilManager.id)
          .maybeSingle();

        if (error) {
          if (error.message.includes('relation') || error.message.includes('does not exist')) {
            setDbMatrixNeedsMigration(true);
          } else {
            console.error('Error fetching council matrix:', error);
          }
        } else if (data) {
          setMatrixData(data);
          setDbMatrixNeedsMigration(false);
        }
      } catch (err) {
        console.error('Matrix retrieval exception:', err);
      }
    };

    fetchMatrix();

    // Subscribe to realtime changes on council_matrix
    const supabase = supabaseService.getClient();
    const matrixChannel = supabase
      .channel(`council-matrix-${councilManager.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'council_matrix',
          filter: `manager_id=eq.${councilManager.id}`,
        },
        (payload) => {
          if (payload.new) {
            setMatrixData(payload.new);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(matrixChannel);
    };
  }, [councilManager]);

  // Fetch full assistant response when modal opens
  useEffect(() => {
    if (!selectedAgent) {
      setFullMessage(null);
      return;
    }

    const fetchMessages = async () => {
      setIsLoadingMessage(true);
      try {
        const res = await fetch(`/api/agent/${selectedAgent.id}/messages`);
        if (res.ok) {
          const data: Message[] = await res.json();
          const assistantMsg = [...data].reverse().find(m => m.role === 'assistant');
          setFullMessage(assistantMsg?.content || selectedAgent.summary || 'No detailed message output recorded.');
        } else {
          setFullMessage(selectedAgent.summary || 'Failed to load details from server.');
        }
      } catch (e) {
        console.error('Error fetching agent messages:', e);
        setFullMessage(selectedAgent.summary || 'Error fetching details.');
      } finally {
        setIsLoadingMessage(false);
      }
    };

    fetchMessages();
  }, [selectedAgent]);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getModelBadgeColor = (model?: string | null) => {
    return 'bg-[#EBE5DC]/55 text-[#5E5B56] border-[#E5E0DA]/70 font-mono tracking-wider font-bold uppercase';
  };

  const parseVerdictContent = (text: string) => {
    if (!text) return null;
    const sections: { consensus?: string; dissent?: string; recommendation?: string; confidence?: string } = {};

    const consensusRegex = /##\s*CONSENSUS([\s\S]*?)(##\s*DISSENT|##\s*FINAL\s*RECOMMENDATION|##\s*CONFIDENCE|$)/i;
    const dissentRegex = /##\s*DISSENT([\s\S]*?)(##\s*CONSENSUS|##\s*FINAL\s*RECOMMENDATION|##\s*CONFIDENCE|$)/i;
    const recommendationRegex = /##\s*FINAL\s*RECOMMENDATION([\s\S]*?)(##\s*CONSENSUS|##\s*DISSENT|##\s*CONFIDENCE|$)/i;
    const confidenceRegex = /##\s*CONFIDENCE([\s\S]*?)(##\s*CONSENSUS|##\s*DISSENT|##\s*FINAL\s*RECOMMENDATION|$)/i;

    const consensusMatch = text.match(consensusRegex);
    const dissentMatch = text.match(dissentRegex);
    const recMatch = text.match(recommendationRegex);
    const confMatch = text.match(confidenceRegex);

    if (consensusMatch) sections.consensus = consensusMatch[1].trim();
    if (dissentMatch) sections.dissent = dissentMatch[1].trim();
    if (recMatch) sections.recommendation = recMatch[1].trim();
    if (confMatch) sections.confidence = confMatch[1].trim();

    if (!sections.consensus && !sections.dissent && !sections.recommendation && !sections.confidence) {
      return null;
    }
    return sections;
  };

  const sqlMigrationCode = `CREATE TABLE IF NOT EXISTS council_matrix (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  manager_id UUID REFERENCES agents(id) ON DELETE CASCADE NOT NULL,
  claims JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
ALTER TABLE council_matrix ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read/write council_matrix" ON council_matrix FOR ALL USING (true) WITH CHECK (true);
ALTER PUBLICATION supabase_realtime ADD TABLE council_matrix;`;

  const copySqlToClipboard = () => {
    navigator.clipboard.writeText(sqlMigrationCode);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2000);
  };

  // Helper to compile statistics metrics from matrix data
  const getMatrixStats = () => {
    if (!matrixData || !matrixData.claims) return { total: 0, strong: 0, split: 0, contested: 0 };
    const claims = matrixData.claims;
    let strong = 0;
    let split = 0;
    let contested = 0;

    claims.forEach((c: any) => {
      const votes = Object.values(c.votes);
      const agrees = votes.filter(v => v === 'agree').length;
      const total = votes.filter(v => v === 'agree' || v === 'disagree' || v === 'neutral').length || 1;
      const pct = (agrees / total) * 100;

      if (pct >= 75) strong++;
      else if (pct >= 50) split++;
      else contested++;
    });

    return { total: claims.length, strong, split, contested };
  };

  const stats = getMatrixStats();

  if (!councilManager) {
    return (
      <div className="flex-grow flex flex-col items-center justify-center p-8 text-center text-xs text-[#85827D] italic border border-dashed border-[#E5E0DA] rounded-xl bg-white/50 h-full">
        <p>No active council debate detected in this workspace.</p>
        <p className="mt-1.5 font-normal text-[10px] leading-relaxed max-w-[200px]">
          Toggle "AI Council Mode" in the input menu and start a goal to view the multi-agent debate visualizer here.
        </p>
      </div>
    );
  }

  // Find Verdict Agent and get its last output for Verdict tab
  const verdictAgent = councilSeats.find(a => a.name === 'Verdict');

  return (
    <div className="flex-grow flex flex-col h-full overflow-hidden select-text animate-fadeIn gap-4">
      
      {/* Database Schema Helper Warning */}
      {dbMatrixNeedsMigration && (
        <div className="bg-amber-50 border border-amber-250 text-amber-900 p-3.5 rounded-xl text-xs space-y-2 animate-fadeIn shrink-0 select-text">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
            <div>
              <p className="font-semibold">Consensus Matrix Database Setup Required</p>
              <p className="text-[11px] opacity-80 leading-relaxed mt-0.5">
                The database table <code>council_matrix</code> is missing. Execute this script inside your Supabase dashboard SQL Editor:
              </p>
            </div>
          </div>
          <div className="relative bg-[#1E1E1E] text-neutral-350 p-2.5 rounded-lg font-mono text-[9px] select-text break-all">
            <button
              onClick={copySqlToClipboard}
              className="absolute top-1.5 right-1.5 p-1 bg-neutral-800 hover:bg-neutral-700 rounded text-neutral-400 hover:text-white transition-colors cursor-pointer"
              title="Copy SQL to Clipboard"
            >
              {copiedSql ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
            </button>
            <pre className="overflow-x-auto whitespace-pre">{sqlMigrationCode}</pre>
          </div>
        </div>
      )}

      {/* Main Tabbed Consensus Matrix Dashboard */}
      {!dbMatrixNeedsMigration && (
        <div className="bg-white border border-[#E5E0DA] rounded-2xl shadow-2xs overflow-hidden flex flex-col min-h-0 flex-grow">
          {/* Dashboard Sub-Tabs Header */}
          <div className="px-3 py-2.5 border-b border-[#F2EFEA] bg-[#FAF8F5] shrink-0">
            <div className="flex bg-[#EBE5DC]/60 p-0.5 gap-0.5 rounded-xl">
              <button
                type="button"
                onClick={() => setActiveSubTab('matrix')}
                className={`flex-1 px-2 py-1.5 text-[10px] font-bold rounded-lg uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1 ${
                  activeSubTab === 'matrix'
                    ? 'bg-white text-[#191919] border border-[#E5E0DA] shadow-3xs'
                    : 'text-[#5E5B56] hover:text-[#191919] hover:bg-[#E2DCD3]/30'
                }`}
              >
                <LayoutGrid className="w-3 h-3" />
                <span>Matrix</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveSubTab('verdict')}
                className={`flex-1 px-2 py-1.5 text-[10px] font-bold rounded-lg uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1 ${
                  activeSubTab === 'verdict'
                    ? 'bg-white text-[#191919] border border-[#E5E0DA] shadow-3xs'
                    : 'text-[#5E5B56] hover:text-[#191919] hover:bg-[#E2DCD3]/30'
                }`}
              >
                <Scale className="w-3 h-3" />
                <span>Verdict</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveSubTab('chart')}
                className={`flex-1 px-2 py-1.5 text-[10px] font-bold rounded-lg uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1 ${
                  activeSubTab === 'chart'
                    ? 'bg-white text-[#191919] border border-[#E5E0DA] shadow-3xs'
                    : 'text-[#5E5B56] hover:text-[#191919] hover:bg-[#E2DCD3]/30'
                }`}
              >
                <BarChart3 className="w-3 h-3" />
                <span>Chart</span>
              </button>
            </div>
          </div>

          {/* Sub-tab view contents */}
          <div className="p-4 flex-grow overflow-y-auto min-h-0 flex flex-col justify-between">
            {!matrixData ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-[11px] text-[#85827D] italic py-16">
                <Loader2 className="w-5 h-5 text-purple-600 animate-spin mb-2" />
                <span>Convene debate loop. Spawning Extractor agent to build consensus matrix...</span>
              </div>
            ) : (
              <div className="flex-1 flex flex-col min-h-0">
                {/* 1. AGREEMENT MATRIX TABLE */}
                {activeSubTab === 'matrix' && (
                  <div className="flex-1 overflow-x-auto min-h-0 select-text">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-[#E5E0DA] text-[#85827D] font-bold uppercase tracking-wider text-[10px] bg-[#FAF8F5]">
                          <th className="p-3 font-semibold font-dmsans">Key claim / decision</th>
                          {/* Seat Headers */}
                          {Object.keys(matrixData.claims?.[0]?.votes || {}).map(seat => (
                            <th key={seat} className="p-3 text-center font-semibold font-dmsans">
                              {seat}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#F2EFEA]">
                        {matrixData.claims.map((row: any, rIdx: number) => (
                          <tr key={rIdx} className="hover:bg-[#FAF9F6] transition-colors">
                            <td className="p-3 font-medium text-[#191919] leading-relaxed max-w-[200px]">
                              {row.claim}
                            </td>
                            {Object.entries(row.votes).map(([seat, vote]: [string, any]) => (
                              <td key={seat} className="p-3 text-center align-middle">
                                <div className="inline-flex items-center justify-center">
                                  {vote === 'agree' && (
                                    <div className="bg-emerald-50 border border-emerald-250 text-emerald-700 p-1 rounded-full" title="Agree">
                                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                                    </div>
                                  )}
                                  {vote === 'disagree' && (
                                    <div className="bg-rose-50 border border-rose-250 text-rose-700 p-1 rounded-full" title="Disagree">
                                      <X className="w-3.5 h-3.5 stroke-[3]" />
                                    </div>
                                  )}
                                  {vote === 'neutral' && (
                                    <div className="bg-neutral-50 border border-neutral-250 text-neutral-600 p-1 rounded-full" title="Neutral">
                                      <Minus className="w-3.5 h-3.5 stroke-[3]" />
                                    </div>
                                  )}
                                </div>
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* 2. VERDICT VIEW */}
                {activeSubTab === 'verdict' && (
                  <div className="flex-1 select-text overflow-y-auto pr-1">
                    {!verdictAgent ? (
                      <p className="text-xs text-[#85827D] italic text-center py-10">No Verdict agent was run for this debate.</p>
                    ) : verdictAgent.status !== 'done' ? (
                      <div className="flex flex-col items-center justify-center text-center py-10 text-xs text-[#85827D] gap-2">
                        <Loader2 className="w-5 h-5 animate-spin text-amber-500" />
                        <span>Verdict agent is synthesizing seat debates...</span>
                      </div>
                    ) : (
                      <div className="space-y-4 pr-1">
                        {/* Render pretty parsed Verdict text */}
                        {(() => {
                          const content = verdictAgent.summary || '';
                          const parsed = parseVerdictContent(content);
                          if (!parsed) {
                            return <pre className="text-xs leading-relaxed text-[#191919] font-lora whitespace-pre-wrap">{content}</pre>;
                          }
                          return (
                            <div className="space-y-3 font-dmsans">
                              {parsed.consensus && (
                                <div className="bg-emerald-50/40 border border-emerald-200/50 rounded-xl p-3">
                                  <h5 className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1.5 mb-1">
                                    <ThumbsUp className="w-3 h-3 text-emerald-600" />
                                    Consensus
                                  </h5>
                                  <p className="text-xs text-[#3E3C38] leading-relaxed font-lora whitespace-pre-wrap">{parsed.consensus}</p>
                                </div>
                              )}
                              {parsed.dissent && (
                                <div className="bg-rose-50/40 border border-rose-200/50 rounded-xl p-3">
                                  <h5 className="text-[10px] font-bold uppercase tracking-wider text-rose-800 flex items-center gap-1.5 mb-1">
                                    <Scale className="w-3 h-3 text-rose-600" />
                                    Dissent
                                  </h5>
                                  <p className="text-xs text-[#3E3C38] leading-relaxed font-lora whitespace-pre-wrap">{parsed.dissent}</p>
                                </div>
                              )}
                              {parsed.recommendation && (
                                <div className="bg-amber-50/40 border border-amber-250/50 rounded-xl p-3 shadow-3xs">
                                  <h5 className="text-[10px] font-bold uppercase tracking-wider text-amber-800 flex items-center gap-1.5 mb-1">
                                    <ThumbsUp className="w-3 h-3 text-amber-600" />
                                    Final Recommendation
                                  </h5>
                                  <p className="text-xs text-[#191919] font-medium leading-relaxed font-lora whitespace-pre-wrap">{parsed.recommendation}</p>
                                </div>
                              )}
                              {parsed.confidence && (
                                <div className="bg-[#FAF8F5] border border-[#E5E0DA] rounded-xl p-3">
                                  <h5 className="text-[10px] font-bold uppercase tracking-wider text-[#5E5B56] flex items-center gap-1.5 mb-1">
                                    <TrendingUp className="w-3 h-3 text-[#85827D]" />
                                    Confidence Rating
                                  </h5>
                                  <p className="text-xs text-[#3E3C38] leading-relaxed font-lora whitespace-pre-wrap">{parsed.confidence}</p>
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                )}

                {/* 3. CONSENSUS BAR CHART */}
                {activeSubTab === 'chart' && (
                  <div className="flex-1 flex flex-col justify-between min-h-0 select-none">
                    {/* Vertical Bar Chart Wrapper */}
                    <div className="flex-grow flex items-end justify-around gap-2 px-4 py-6 border border-[#F2EFEA] bg-[#FAF8F5]/30 rounded-xl min-h-[220px]">
                      {matrixData.claims.map((row: any, rIdx: number) => {
                        const votes = Object.values(row.votes);
                        const agrees = votes.filter(v => v === 'agree').length;
                        const total = votes.filter(v => v === 'agree' || v === 'disagree' || v === 'neutral').length || 1;
                        const agreementPercent = Math.round((agrees / total) * 100);

                        let barColor = 'bg-rose-500 border-rose-600';
                        if (agreementPercent >= 75) {
                          barColor = 'bg-emerald-500 border-emerald-600';
                        } else if (agreementPercent >= 50) {
                          barColor = 'bg-amber-500 border-amber-600';
                        }

                        return (
                          <div key={rIdx} className="flex flex-col items-center flex-1 max-w-[50px] h-full group relative">
                            {/* Hover Tooltip showing full claim */}
                            <div className="absolute bottom-full mb-2 hidden group-hover:block bg-[#191919] text-white p-2 rounded-lg text-[10px] font-medium w-40 z-20 shadow-lg text-center leading-normal transition-all font-dmsans">
                              <p className="font-semibold text-neutral-350 mb-0.5">Claim #{rIdx + 1}</p>
                              <p className="font-normal font-lora">{row.claim}</p>
                              <p className="mt-1 text-purple-400 font-semibold">{agreementPercent}% Consensus</p>
                            </div>

                            {/* Percentage header */}
                            <span className="text-[10px] font-bold text-[#5E5B56] mb-1 font-mono">
                              {agreementPercent}%
                            </span>

                            {/* The vertical bar */}
                            <div className="w-full bg-[#FAF8F5] border border-[#E5E0DA] rounded-t-md flex-grow flex items-end relative overflow-hidden">
                              <div 
                                className={`w-full rounded-t-sm border-t ${barColor} transition-all duration-500`}
                                style={{ height: `${agreementPercent}%` }}
                              />
                            </div>

                            {/* Claim label */}
                            <span className="text-[9px] font-bold text-[#85827D] mt-1.5 uppercase font-mono tracking-tight text-center">
                              C#{rIdx + 1}
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    {/* Chart Legend */}
                    <div className="flex items-center justify-center gap-6 mt-3.5 shrink-0 text-[10px] font-semibold text-[#5E5B56] font-dmsans border-t border-[#F2EFEA] pt-3 select-none">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded bg-emerald-500 border border-emerald-600" />
                        <span>Strong Consensus (&gt;=75%)</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded bg-amber-500 border border-amber-600" />
                        <span>Split Decisions (50-74%)</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded bg-rose-500 border border-rose-600" />
                        <span>Contested (&lt;50%)</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Dashboard metrics stats summary footer */}
            {matrixData && (
              <div className="grid grid-cols-2 gap-2 mt-3 shrink-0 select-none border-t border-[#F2EFEA] pt-3 font-dmsans">
                <div className="bg-[#FAF8F5]/80 border border-[#E5E0DA] rounded-xl p-2 text-center shadow-3xs">
                  <span className="text-lg font-extrabold text-emerald-700 leading-none block font-mono">
                    {stats.strong}
                  </span>
                  <span className="text-[8px] font-bold uppercase tracking-wider text-[#85827D] block mt-0.5 leading-tight">
                    strong
                  </span>
                </div>
                <div className="bg-[#FAF8F5]/80 border border-[#E5E0DA] rounded-xl p-2 text-center shadow-3xs">
                  <span className="text-lg font-extrabold text-amber-700 leading-none block font-mono">
                    {stats.split}
                  </span>
                  <span className="text-[8px] font-bold uppercase tracking-wider text-[#85827D] block mt-0.5 leading-tight">
                    split
                  </span>
                </div>
                <div className="bg-[#FAF8F5]/80 border border-[#E5E0DA] rounded-xl p-2 text-center shadow-3xs">
                  <span className="text-lg font-extrabold text-rose-700 leading-none block font-mono">
                    {stats.contested}
                  </span>
                  <span className="text-[8px] font-bold uppercase tracking-wider text-[#85827D] block mt-0.5 leading-tight">
                    contested
                  </span>
                </div>
                <div className="bg-[#FAF8F5]/80 border border-[#E5E0DA] rounded-xl p-2 text-center shadow-3xs">
                  <span className="text-lg font-extrabold text-[#191919] leading-none block font-mono">
                    {stats.total}
                  </span>
                  <span className="text-[8px] font-bold uppercase tracking-wider text-[#85827D] block mt-0.5 leading-tight">
                    total
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Debate Seats — Vertical Stacked Cards */}
      <div className="space-y-2 shrink-0">
        <div className="flex items-center justify-between text-[11px] font-bold text-[#85827D] uppercase tracking-wider mb-1.5 font-dmsans">
          <span>Debate Seats</span>
          <span className="text-[10px] bg-[#E9E3DB] text-[#191919] px-2 py-0.5 rounded-full font-bold select-none">
            {councilSeats.length} Seats
          </span>
        </div>

        <div className="space-y-1.5 overflow-y-auto max-h-[260px] pr-0.5">
          {sortedSeats.map((seat) => {
            const isVerdict = seat.name === 'Verdict';
            const isDone = seat.status === 'done';
            const isRunning = seat.status === 'running';
            const isPending = seat.status === 'pending';
            const isError = seat.status === 'error';

            return (
              <div
                key={seat.id}
                className={`flex items-center gap-2.5 p-2 rounded-xl border transition-all duration-150 cursor-pointer hover:shadow-xs ${
                  isVerdict
                    ? 'bg-gradient-to-r from-[#FFFDF9] to-[#FFF9EE] border-amber-200 hover:border-amber-300'
                    : 'bg-white border-[#E5E0DA] hover:border-[#CDC7C0]'
                } ${isRunning ? 'ring-1 ring-emerald-400/30 border-emerald-300' : ''}`}
                onClick={() => (isDone || isError) ? setSelectedAgent(seat) : undefined}
              >
                {/* Status Indicator */}
                <div className="shrink-0">
                  {isDone && (
                    <div className="w-6 h-6 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center">
                      <Check className="w-3 h-3 text-emerald-600 stroke-[3]" />
                    </div>
                  )}
                  {isRunning && (
                    <div className="w-6 h-6 rounded-full bg-blue-50 border border-blue-200 flex items-center justify-center">
                      <Loader2 className="w-3 h-3 text-blue-600 animate-spin" />
                    </div>
                  )}
                  {isPending && (
                    <div className="w-6 h-6 rounded-full bg-neutral-50 border border-neutral-200 flex items-center justify-center">
                      <div className="w-2 h-2 rounded-full bg-neutral-300" />
                    </div>
                  )}
                  {isError && (
                    <div className="w-6 h-6 rounded-full bg-red-50 border border-red-200 flex items-center justify-center">
                      <AlertCircle className="w-3 h-3 text-red-500" />
                    </div>
                  )}
                </div>

                {/* Name + Role */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className={`text-xs font-bold truncate ${
                      isVerdict ? 'text-amber-900' : 'text-[#191919]'
                    }`}>
                      {seat.name}
                    </span>
                    {isVerdict && <Scale className="w-3 h-3 text-amber-700 shrink-0" />}
                  </div>
                  <span className="text-[10px] text-[#85827D] truncate block leading-tight">
                    {seat.role}
                  </span>
                </div>

                {/* Model Badge */}
                <span className={`text-[8px] px-1.5 py-0.5 rounded border font-semibold truncate max-w-[70px] shrink-0 ${getModelBadgeColor(seat.model)}`}>
                  {seat.model ? seat.model.split('/').pop() : 'Default'}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Modal Overlay for Full Output */}
      {selectedAgent && (
        <div className="fixed inset-0 bg-[#000000]/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn select-text">
          <div className="bg-[#FAF8F5] border border-[#CDC7C0] rounded-2xl w-full max-w-[550px] max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-slideUp">
            {/* Modal Header */}
            <div className="p-4 border-b border-[#E5E0DA] bg-white flex items-center justify-between shrink-0">
              <div className="flex flex-col gap-0.5">
                <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider">
                  {selectedAgent.role}
                </span>
                <h3 className="text-sm font-bold text-[#191919] font-dmsans">
                  {selectedAgent.name} Viewpoint
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleCopy(fullMessage || '', selectedAgent.id)}
                  className="p-2 hover:bg-[#FAF8F5] border border-transparent hover:border-[#E5E0DA] rounded-lg text-[#5E5B56] hover:text-[#191919] transition-all cursor-pointer flex items-center gap-1.5"
                  title="Copy full output"
                >
                  {copiedId === selectedAgent.id ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-600" />
                      <span className="text-xs text-emerald-800 font-semibold">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      <span className="text-xs font-semibold">Copy</span>
                    </>
                  )}
                </button>
                <button
                  onClick={() => setSelectedAgent(null)}
                  className="p-1.5 hover:bg-neutral-100 rounded-lg text-[#85827D] hover:text-[#191919] transition-colors cursor-pointer border border-[#E5E0DA]"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Modal Scrollable Content */}
            <div className="p-5 flex-grow overflow-y-auto scrollbar-thin select-text">
              {isLoadingMessage ? (
                <div className="flex flex-col items-center justify-center py-20 text-center text-xs text-[#85827D] gap-2">
                  <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
                  <span>Loading full output from debate...</span>
                </div>
              ) : selectedAgent.name === 'Verdict' && parseVerdictContent(fullMessage || '') ? (
                /* Pretty verdict parsing */
                (() => {
                  const parts = parseVerdictContent(fullMessage || '');
                  if (!parts) return null;
                  return (
                    <div className="space-y-4 font-dmsans">
                      {parts.consensus && (
                        <div className="bg-emerald-50/40 border border-emerald-200/60 rounded-xl p-3.5 space-y-1.5">
                          <h4 className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
                            <ThumbsUp className="w-3.5 h-3.5 text-emerald-600" />
                            Consensus
                          </h4>
                          <p className="text-xs text-[#3E3C38] leading-relaxed font-lora whitespace-pre-wrap">
                            {parts.consensus}
                          </p>
                        </div>
                      )}

                      {parts.dissent && (
                        <div className="bg-rose-50/40 border border-rose-200/60 rounded-xl p-3.5 space-y-1.5">
                          <h4 className="text-[11px] font-bold uppercase tracking-wider text-rose-800 flex items-center gap-1.5">
                            <Scale className="w-3.5 h-3.5 text-rose-600" />
                            Dissent
                          </h4>
                          <p className="text-xs text-[#3E3C38] leading-relaxed font-lora whitespace-pre-wrap">
                            {parts.dissent}
                          </p>
                        </div>
                      )}

                      {parts.recommendation && (
                        <div className="bg-amber-50/40 border border-amber-250/60 rounded-xl p-3.5 space-y-1.5 shadow-2xs">
                           <h4 className="text-[11px] font-bold uppercase tracking-wider text-amber-800 flex items-center gap-1.5">
                            <ThumbsUp className="w-3.5 h-3.5 text-amber-600" />
                            Final Recommendation
                          </h4>
                          <p className="text-xs text-[#191919] font-medium leading-relaxed font-lora whitespace-pre-wrap">
                            {parts.recommendation}
                          </p>
                        </div>
                      )}

                      {parts.confidence && (
                        <div className="bg-[#FAF8F5] border border-[#E5E0DA] rounded-xl p-3.5 space-y-1.5">
                          <h4 className="text-[11px] font-bold uppercase tracking-wider text-[#5E5B56] flex items-center gap-1.5">
                            <TrendingUp className="w-3.5 h-3.5 text-[#85827D]" />
                            Confidence Matrix
                          </h4>
                          <p className="text-xs text-[#3E3C38] leading-relaxed font-lora whitespace-pre-wrap">
                            {parts.confidence}
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })()
              ) : (
                /* Plain Markdown fallback */
                <pre className="text-xs leading-relaxed text-[#191919] font-lora whitespace-pre-wrap break-words select-text">
                  {fullMessage || '*No response text recorded.*'}
                </pre>
              )}
            </div>
            
            {/* Modal Footer */}
            <div className="p-3.5 border-t border-[#E5E0DA] bg-[#FAF8F5] flex justify-end shrink-0">
              <button
                onClick={() => setSelectedAgent(null)}
                className="px-4 py-2 bg-[#191919] hover:bg-neutral-800 text-white rounded-lg text-xs font-bold transition-all cursor-pointer shadow-xs"
              >
                Close Viewpoint
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
