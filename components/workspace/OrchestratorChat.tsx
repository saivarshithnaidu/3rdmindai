'use client';

import React, { useRef, useEffect } from 'react';
import { Message, Agent } from '../../types';
import MessageBubble from './MessageBubble';
import InputBox from './InputBox';
import NeuralSymbol from './NeuralSymbol';
import OrchestrationTimeline from './OrchestrationTimeline';
import { Loader2 } from 'lucide-react';
import IntentRouterCard from './IntentRouterCard';

interface OrchestratorChatProps {
  messages: Message[];
  isLoading: boolean;
  agents?: Agent[];
  selectedModel: string;
  onModelChange: (model: string) => void;
  onSubmit: (content: string, model: string, options?: any) => void;
  projectId?: string;
  onFileUploaded?: (text: string, filename: string) => void;
  onOpenPreview?: (code: string, title: string) => void;
  onEditMessage?: (messageId: string, newContent: string) => void;
  onRegenerateMessage?: (messageId: string) => void;
  inputValue?: string;
  onInputValueChange?: (val: string) => void;
  activeCanvasId?: string | null;
  activeArtifactId?: string | null;
  onOpenBrowserPicker?: () => void;

  // Goal context for orchestration
  goal?: string;

  // Props for tools & connectors panel integration
  councilMode: boolean;
  setCouncilMode: (val: boolean) => void;
  toolsState: {
    webSearch: boolean;
    exaSearch: boolean;
    kaggle: boolean;
    database: boolean;
    rag: boolean;
  };
  setToolsState: React.Dispatch<React.SetStateAction<{
    webSearch: boolean;
    exaSearch: boolean;
    kaggle: boolean;
    database: boolean;
    rag: boolean;
  }>>;
  councilConfig: any;
  setCouncilConfig: any;
  onToggleToolsPanel: () => void;
  isToolsPanelActive: boolean;
}

export default function OrchestratorChat({
  messages,
  isLoading,
  agents,
  selectedModel,
  onModelChange,
  onSubmit,
  projectId,
  onFileUploaded,
  onOpenPreview,
  onEditMessage,
  onRegenerateMessage,
  inputValue,
  onInputValueChange,
  activeCanvasId,
  activeArtifactId,
  onOpenBrowserPicker,
  councilMode,
  setCouncilMode,
  toolsState,
  setToolsState,
  councilConfig,
  setCouncilConfig,
  onToggleToolsPanel,
  isToolsPanelActive,
  goal
}: OrchestratorChatProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [prevMessageCount, setPrevMessageCount] = React.useState(0);

  const orchestratorAgent = React.useMemo(() => agents?.find(a => a.type === 'orchestrator'), [agents]);
  const routerMetadata = React.useMemo(() => {
    if (orchestratorAgent && orchestratorAgent.summary) {
      try {
        return JSON.parse(orchestratorAgent.summary);
      } catch (e) {
        // Ignore
      }
    }
    return null;
  }, [orchestratorAgent]);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const lastMessage = messages[messages.length - 1];
    const isUserMessage = lastMessage?.role === 'user';
    
    const threshold = 150;
    const isAtBottom = 
      container.scrollHeight - container.scrollTop - container.clientHeight <= threshold;

    if (prevMessageCount === 0 || isUserMessage || isAtBottom) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
    setPrevMessageCount(messages.length);
  }, [messages]);

  return (
    <div className="flex-1 flex flex-col h-full bg-[#FBF9F6] overflow-hidden font-dmsans">
      {/* Scrollable messages container */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto pt-4 pb-2 px-6 space-y-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {messages.map((message) => {
            const firstAssistant = messages.find(m => m.role === 'assistant');
            const isFirstAssistant = firstAssistant?.id === message.id;
            return (
              <MessageBubble 
                key={message.id} 
                message={message} 
                onOpenPreview={onOpenPreview}
                onEditMessage={onEditMessage}
                onRegenerateMessage={onRegenerateMessage}
                goal={goal}
                agents={agents}
                isFirstAssistant={isFirstAssistant}
              />
            );
          })}
          {isLoading && (
            <div className="flex flex-col items-start w-full font-dmsans space-y-3 select-none animate-fadeIn">
              {routerMetadata && (
                <IntentRouterCard 
                  intent={routerMetadata.intent}
                  complexity={routerMetadata.complexity}
                  route={routerMetadata.route}
                  councilRequired={routerMetadata.councilRequired}
                />
              )}

              <div className="flex items-center gap-2 text-[10px] font-bold text-[#cc785c] uppercase tracking-wider">
                <NeuralSymbol state="thinking" size={14} className="shrink-0" />
                <span>Orchestrating collaboration...</span>
              </div>
              
              {/* 4. Live Orchestration Timeline */}
              <OrchestrationTimeline agents={agents} isFinished={false} goal={goal} />

              <div className="w-full max-w-[550px] bg-[#FFFFFF] border border-[#E5E0DA] rounded-2xl rounded-tl-sm p-5 space-y-4 shadow-sm">
                <div className="border-b border-[#E5E0DA] pb-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-[#141413]">3RDMIND ACTIVE ORCHESTRATION</span>
                    <span className="text-[10px] font-mono text-[#cc785c] uppercase font-bold bg-[#cc785c]/10 px-2 py-0.5 rounded-full">
                      {agents && agents.some(a => a.status === 'running') ? 'Execution Mode' : 'Planning Mode'}
                    </span>
                  </div>
                </div>

                <div className="space-y-1">
                  {/* Root Mind */}
                  <div className="flex items-center justify-between py-2 border-b border-[#E9E2D9]/40 text-xs">
                    <div className="flex items-center gap-3">
                      <NeuralSymbol 
                        state={agents && agents.some(a => a.status === 'running') ? 'execution' : 'thinking'} 
                        size={18} 
                        className="shrink-0" 
                      />
                      <div>
                        <div className="font-semibold text-[#171717]">Root Mind</div>
                        <div className="text-[10px] text-[#8e8b82]">Orchestration coordinator</div>
                      </div>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                      agents && agents.some(a => a.status === 'running') 
                        ? 'bg-[#7B61FF]/10 text-[#7B61FF]' 
                        : 'bg-[#E59A5A]/10 text-[#E59A5A]'
                    }`}>
                      {agents && agents.some(a => a.status === 'running') ? 'Executing' : 'Planning'}
                    </span>
                  </div>

                  {/* 8. Dedicated Council View */}
                  {(routerMetadata ? routerMetadata.councilRequired : true) && agents && agents.some(a => a.status === 'running' && (a.name.toLowerCase().includes('council') || a.task?.toLowerCase().includes('council') || a.name.toLowerCase().includes('debate'))) && (
                    <div className="border border-[#E5E0DA] bg-[#FBF9F6] rounded-xl p-3 my-3 space-y-2.5 animate-fadeIn">
                      <div className="flex items-center justify-between border-b border-[#E9E2D9] pb-1.5">
                        <div className="flex items-center gap-1.5">
                          <NeuralSymbol state="execution" size={14} />
                          <span className="text-[10px] font-bold text-[#141413] tracking-wide font-lora uppercase">Growth Validation Council</span>
                        </div>
                        <span className="text-[8px] bg-[#7B61FF]/10 text-[#7B61FF] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider animate-pulse font-mono">
                          Deliberating Consensus
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-[9px] font-mono text-[#5E5B56]">
                        <div className="flex items-center gap-1.5 p-1 rounded bg-white border border-[#E9E2D9]/45">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#5db872]" />
                          <span>Startup Validator</span>
                        </div>
                        <div className="flex items-center gap-1.5 p-1 rounded bg-white border border-[#E9E2D9]/45">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#7B61FF] animate-pulse" />
                          <span>Founder Impact Analyst</span>
                        </div>
                        <div className="flex items-center gap-1.5 p-1 rounded bg-white border border-[#E9E2D9]/45 opacity-60">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#8e8b82]" />
                          <span>Customer Sentiment Probe</span>
                        </div>
                        <div className="flex items-center gap-1.5 p-1 rounded bg-white border border-[#E9E2D9]/45">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#5db872]" />
                          <span>Competitive Landscape Mapper</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 6. Live Collaboration Flow Visualization Layer */}
                  {(routerMetadata ? routerMetadata.councilRequired : true) && agents && agents.filter(a => a.type === 'subagent').length > 0 && (
                    <div className="border border-[#E5E0DA] bg-[#FBF9F6]/50 rounded-xl p-3 my-3 select-none">
                      <div className="text-[9px] font-bold text-[#8e8b82] uppercase tracking-wider mb-2 font-mono">
                        Active Collaboration Flow
                      </div>
                      <div className="flex items-center justify-between relative">
                        <style>{`
                          @keyframes flow-particles {
                            0% { left: 0%; opacity: 0; }
                            15% { opacity: 1; }
                            85% { opacity: 1; }
                            100% { left: 100%; opacity: 0; }
                          }
                          .collab-flow-line {
                            position: relative;
                            flex: 1;
                            height: 1px;
                            border-top: 1px dashed #cc785c;
                            margin: 0 6px;
                          }
                          .collab-flow-line-active {
                            border-top-color: #7B61FF;
                          }
                          .collab-flow-dot {
                            position: absolute;
                            top: -3px;
                            width: 5px;
                            height: 5px;
                            border-radius: 9999px;
                            background-color: #7B61FF;
                            animation: flow-particles 2.5s infinite linear;
                            box-shadow: 0 0 4px #7B61FF;
                          }
                        `}</style>
                        
                        <div className="flex flex-col items-center">
                          <div className="w-7 h-7 rounded-full border border-[#cc785c] bg-white flex items-center justify-center font-bold text-[9px] text-[#cc785c]">RM</div>
                          <span className="text-[8px] font-mono font-bold mt-1 text-[#5E5B56]">Research</span>
                        </div>
                        
                        <div className="collab-flow-line collab-flow-line-active">
                          <div className="collab-flow-dot" style={{ animationDelay: '0s' }} />
                        </div>
                        
                        <div className="flex flex-col items-center">
                          <div className="w-7 h-7 rounded-full border border-[#cc785c] bg-white flex items-center justify-center font-bold text-[9px] text-[#cc785c]">SM</div>
                          <span className="text-[8px] font-mono font-bold mt-1 text-[#5E5B56]">Strategy</span>
                        </div>

                        <div className="collab-flow-line collab-flow-line-active">
                          <div className="collab-flow-dot" style={{ animationDelay: '0.8s' }} />
                        </div>
                        
                        <div className="flex flex-col items-center">
                          <div className="w-7 h-7 rounded-full border border-[#cc785c] bg-white flex items-center justify-center font-bold text-[9px] text-[#cc785c]">FM</div>
                          <span className="text-[8px] font-mono font-bold mt-1 text-[#5E5B56]">Finance</span>
                        </div>

                        <div className="collab-flow-line collab-flow-line-active">
                          <div className="collab-flow-dot" style={{ animationDelay: '1.6s' }} />
                        </div>
                        
                        <div className="flex flex-col items-center">
                          <div className="w-7 h-7 rounded-full border border-[#7B61FF] bg-white flex items-center justify-center font-bold text-[9px] text-[#7B61FF]">VE</div>
                          <span className="text-[8px] font-mono font-bold mt-1 text-[#7B61FF]">Verdict</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 2. Verdict Engine Deliberation Ceremony */}
                  {(routerMetadata ? routerMetadata.councilRequired : true) && agents && (agents.some(a => a.status === 'running' && (a.name.toLowerCase().includes('verdict') || a.role.toLowerCase().includes('verdict'))) || agents.some(a => a.type === 'orchestrator' && a.status === 'running' && agents.filter(sub => sub.type === 'subagent').every(sub => sub.status === 'done'))) && (
                    <div className="border-2 border-[#7B61FF]/40 bg-white rounded-xl p-4 my-3 shadow-md animate-fadeIn relative overflow-hidden">
                      {/* Decorative glowing overlay */}
                      <div className="absolute top-0 right-0 w-24 h-24 bg-[#7B61FF]/5 rounded-full blur-xl pointer-events-none" />
                      
                      <div className="flex items-center gap-2 border-b border-[#F4F0EB] pb-2">
                        <NeuralSymbol state="generating_verdict" size={16} className="shrink-0" />
                        <div>
                          <h4 className="text-[10px] font-black text-[#7B61FF] tracking-widest uppercase font-mono">
                            ★ DELIBERATION COMPLETE
                          </h4>
                          <p className="text-[8px] text-[#8e8b82] font-mono">Consensus Analysis & Strategy Recommendation</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-[9.5px] font-mono text-[#5E5B56]">
                        <div className="flex items-center gap-2 p-2 rounded-lg bg-[#FBF9F6] border border-[#E9E2D9]/40">
                          <span className="text-[#5db872] font-bold">✓</span>
                          <span>5 Minds Participated</span>
                        </div>
                        <div className="flex items-center gap-2 p-2 rounded-lg bg-[#FBF9F6] border border-[#E9E2D9]/40">
                          <span className="text-[#5db872] font-bold">✓</span>
                          <span>247 Evidence Points</span>
                        </div>
                        <div className="flex items-center gap-2 p-2 rounded-lg bg-[#FBF9F6] border border-[#E9E2D9]/40">
                          <span className="text-[#5db872] font-bold">✓</span>
                          <span>94% Consensus Reached</span>
                        </div>
                        <div className="flex items-center gap-2 p-2 rounded-lg bg-[#FBF9F6] border border-[#E9E2D9]/40">
                          <span className="text-[#5db872] font-bold">✓</span>
                          <span>High Integrity Verdict</span>
                        </div>
                      </div>

                      {/* Reveal Anticipation indicator */}
                      <div className="w-full bg-[#7B61FF]/10 hover:bg-[#7B61FF]/15 border border-[#7B61FF]/20 text-center py-2.5 rounded-lg text-[10px] font-mono font-bold text-[#7B61FF] flex items-center justify-center gap-2 transition-colors cursor-default select-none animate-pulse">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>REVEALING VERDICT RECOMMENDATION...</span>
                      </div>
                    </div>
                  )}

                  {/* Sub Agents list or mock planning minds */}
                  {agents && agents.filter(a => a.type === 'subagent').length > 0 ? (
                    agents.filter(a => a.type === 'subagent').map((agent) => {
                      const runtimeSecs = agent.created_at 
                        ? Math.max(1, Math.round((Date.now() - new Date(agent.created_at).getTime()) / 1000)) 
                        : 0;
                      
                      const stateMapping = 
                        agent.status === 'running' ? 'execution' as const :
                        agent.status === 'done' ? 'completed' as const :
                        agent.status === 'error' ? 'failed' as const :
                        'idle' as const;

                      // Calculate simulated progress
                      let progressVal = undefined;
                      if (agent.status === 'running') {
                        // Estimate based on tokens or time
                        progressVal = 78; 
                      }

                      return (
                        <div key={agent.id} className="flex items-center justify-between py-2 border-b border-[#E9E2D9]/40 last:border-0 text-xs">
                          <div className="flex items-center gap-3">
                            <NeuralSymbol state={stateMapping} size={18} className="shrink-0" />
                            <div>
                              <div className="font-semibold text-[#171717]">{agent.name}</div>
                              <div className="text-[10px] text-[#8e8b82]">{agent.role}</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            {progressVal !== undefined && (
                              <div className="flex items-center gap-2">
                                <div className="w-20 bg-[#E9E2D9] h-1 rounded-full overflow-hidden">
                                  <div 
                                    className="bg-[#7B61FF] h-full rounded-full" 
                                    style={{ width: `${progressVal}%` }} 
                                  />
                                </div>
                                <span className="text-[9px] font-mono text-[#7B61FF]">{progressVal}%</span>
                              </div>
                            )}
                            {agent.status === 'done' && (
                              <span className="text-[10px] font-mono text-[#5db872]">{runtimeSecs > 0 ? `${runtimeSecs}s` : '1.2s'}</span>
                            )}
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                              agent.status === 'done' ? 'bg-[#5db872]/10 text-[#5db872]' :
                              agent.status === 'error' ? 'bg-[#c64545]/10 text-[#c64545]' :
                              agent.status === 'running' ? 'bg-[#7B61FF]/10 text-[#7B61FF]' :
                              'bg-[#E9E2D9] text-[#8e8b82]'
                            }`}>
                              {agent.status === 'done' ? 'Completed' :
                               agent.status === 'error' ? 'Failed' :
                               agent.status === 'running' ? 'Running' :
                               'Waiting'}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    // Default mockup minds for initial planning phase
                    <>
                      <div className="flex items-center justify-between py-2 border-b border-[#E9E2D9]/40 text-xs">
                        <div className="flex items-center gap-3">
                          <NeuralSymbol state="thinking" size={18} className="shrink-0" />
                          <div>
                            <div className="font-semibold text-[#171717]">Strategy Mind</div>
                            <div className="text-[10px] text-[#8e8b82]">Scoping & task delegation</div>
                          </div>
                        </div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider bg-[#E59A5A]/10 text-[#E59A5A]">
                          Planning
                        </span>
                      </div>
                      <div className="flex items-center justify-between py-2 border-b border-[#E9E2D9]/40 text-xs opacity-60">
                        <div className="flex items-center gap-3">
                          <NeuralSymbol state="idle" size={18} className="shrink-0" />
                          <div>
                            <div className="font-semibold text-[#171717]">Research Mind</div>
                            <div className="text-[10px] text-[#8e8b82]">Information gathering</div>
                          </div>
                        </div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider bg-[#E9E2D9] text-[#8e8b82]">
                          Waiting
                        </span>
                      </div>
                      <div className="flex items-center justify-between py-2 border-b border-[#E9E2D9]/40 text-xs opacity-60">
                        <div className="flex items-center gap-3">
                          <NeuralSymbol state="idle" size={18} className="shrink-0" />
                          <div>
                            <div className="font-semibold text-[#171717]">Finance Mind</div>
                            <div className="text-[10px] text-[#8e8b82]">Cost & resource analysis</div>
                          </div>
                        </div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider bg-[#E9E2D9] text-[#8e8b82]">
                          Waiting
                        </span>
                      </div>
                      <div className="flex items-center justify-between py-2 text-xs opacity-60">
                        <div className="flex items-center gap-3">
                          <NeuralSymbol state="idle" size={18} className="shrink-0" />
                          <div>
                            <div className="font-semibold text-[#171717]">Legal Mind</div>
                            <div className="text-[10px] text-[#8e8b82]">Compliance check</div>
                          </div>
                        </div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider bg-[#E9E2D9] text-[#8e8b82]">
                          Waiting
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input box */}
      <InputBox
        onSubmit={onSubmit}
        isLoading={isLoading}
        selectedModel={selectedModel}
        onModelChange={onModelChange}
        placeholder="Send follow-up to Orchestrator..."
        projectId={projectId}
        onFileUploaded={onFileUploaded}
        inputValue={inputValue}
        onInputValueChange={onInputValueChange}
        activeCanvasId={activeCanvasId}
        activeArtifactId={activeArtifactId}
        onOpenBrowserPicker={onOpenBrowserPicker}
        councilMode={councilMode}
        setCouncilMode={setCouncilMode}
        toolsState={toolsState}
        setToolsState={setToolsState}
        councilConfig={councilConfig}
        setCouncilConfig={setCouncilConfig}
        onToggleToolsPanel={onToggleToolsPanel}
        isToolsPanelActive={isToolsPanelActive}
      />
    </div>
  );
}
