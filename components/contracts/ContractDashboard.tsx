'use client';

import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  Upload, 
  Sparkles, 
  Plus, 
  RefreshCw, 
  AlertCircle, 
  FileCheck2,
  Trash2
} from 'lucide-react';
import ContractAnalysis from './ContractAnalysis';
import TemplateGenerator from './TemplateGenerator';
import LiveFeed from '../stream/LiveFeed';
import { StreamEventType } from '../../types';

interface ContractSummary {
  id: string;
  name: string;
  contract_type: 'nda' | 'client' | 'employment' | 'founder' | 'vendor' | 'other';
  status: 'analyzing' | 'complete' | 'failed';
  risk_level: 'high' | 'medium' | 'low' | null;
  overall_score: number | null;
  created_at: string;
}

interface ContractDashboardProps {
  projectId: string;
  userId: string;
}

export default function ContractDashboard({ projectId, userId }: ContractDashboardProps) {
  const [activeTab, setActiveTab] = useState<'agreements' | 'templates'>('agreements');
  const [contracts, setContracts] = useState<ContractSummary[]>([]);
  const [selectedContractId, setSelectedContractId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Upload Form State
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadType, setUploadType] = useState<'nda' | 'client' | 'employment' | 'founder' | 'vendor' | 'other'>('nda');
  const [isUploading, setIsUploading] = useState(false);
  const [showUploadForm, setShowUploadForm] = useState(false);

  const fetchContracts = async (autoSelectId?: string) => {
    try {
      const res = await fetch(`/api/contracts/list?projectId=${projectId}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.contracts)) {
        setContracts(data.contracts);

        if (data.contracts.length > 0) {
          const toSelect = autoSelectId
            ? data.contracts.find((c: any) => c.id === autoSelectId) || data.contracts[0]
            : selectedContractId
            ? data.contracts.find((c: any) => c.id === selectedContractId) || data.contracts[0]
            : data.contracts[0];
          setSelectedContractId(toSelect.id);
        } else {
          setSelectedContractId(null);
        }
      }
    } catch (err) {
      console.error('Failed to fetch contracts:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContracts();
  }, [projectId]);

  // Polling for analyzing contracts
  useEffect(() => {
    const hasAnalyzing = contracts.some(c => c.status === 'analyzing');
    if (!hasAnalyzing) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/contracts/list?projectId=${projectId}`);
        const data = await res.json();
        if (data.success && Array.isArray(data.contracts)) {
          setContracts(data.contracts);
          // If the currently selected contract's status updated, trigger selected reload
          const current = data.contracts.find((c: any) => c.id === selectedContractId);
          const localMatch = contracts.find(c => c.id === selectedContractId);
          if (current && localMatch && current.status !== localMatch.status) {
            fetchContracts(selectedContractId || undefined);
          }
        }
      } catch (err) {
        console.warn('Failed to poll contract list updates:', err);
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [contracts, selectedContractId, projectId]);

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', uploadFile);
    formData.append('projectId', projectId);
    formData.append('userId', userId);
    formData.append('contractType', uploadType);

    try {
      const res = await fetch('/api/contracts/upload', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (data.success && data.contractId) {
        setUploadFile(null);
        setShowUploadForm(false);
        // Reload list and select new contract
        fetchContracts(data.contractId);
      } else {
        alert(`Failed to upload: ${data.error || 'Unknown error'}`);
      }
    } catch (err) {
      console.error('Upload failed:', err);
      alert('Error uploading document.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setUploadFile(e.target.files[0]);
    }
  };

  const getContractTypeLabel = (type: string) => {
    switch (type) {
      case 'nda': return 'NDA';
      case 'founder': return 'Founder Equity';
      case 'client': return 'Client Service';
      case 'employment': return 'Employment';
      case 'vendor': return 'Vendor';
      default: return 'Other';
    }
  };

  const getSelectedContract = () => {
    return contracts.find(c => c.id === selectedContractId) || null;
  };

  const selectedContract = getSelectedContract();

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-screen bg-canvas font-dmsans">
        <RefreshCw className="w-6 h-6 text-[#cc785c] animate-spin" />
        <span className="text-xs text-muted-soft mt-2.5">Syncing Contract Records...</span>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden font-dmsans">
      {/* Tab bar header */}
      <div className="px-6 bg-[#FFFFFF] border-b border-hairline flex items-center justify-between shrink-0 select-none">
        <div className="flex gap-4 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('agreements')}
            className={`py-3.5 border-b-2 cursor-pointer transition-all ${
              activeTab === 'agreements'
                ? 'border-[#cc785c] text-ink font-bold'
                : 'border-transparent text-muted hover:text-ink'
            }`}
          >
            My Agreements ({contracts.length})
          </button>
          <button
            onClick={() => setActiveTab('templates')}
            className={`py-3.5 border-b-2 cursor-pointer transition-all ${
              activeTab === 'templates'
                ? 'border-[#cc785c] text-ink font-bold'
                : 'border-transparent text-muted hover:text-ink'
            }`}
          >
            Standard Templates
          </button>
        </div>

        {activeTab === 'agreements' && (
          <button
            onClick={() => setShowUploadForm(prev => !prev)}
            className="flex items-center gap-1 px-3 py-1.5 bg-[#cc785c] hover:bg-[#a9583e] text-white rounded-lg text-xs font-semibold cursor-pointer transition-colors shadow-2xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Upload Contract</span>
          </button>
        )}
      </div>

      {activeTab === 'templates' ? (
        <div className="flex-1 overflow-y-auto p-6 bg-canvas">
          <TemplateGenerator projectId={projectId} />
        </div>
      ) : (
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
          
          {/* Left panel: Agreements Sidebar list */}
          <div className="w-full lg:w-72 border-b lg:border-b-0 lg:border-r border-hairline bg-surface-soft/45 flex flex-col shrink-0">
            
            {/* Upload form slide-in */}
            {showUploadForm && (
              <div className="p-4 border-b border-hairline bg-white animate-slideUp">
                <form onSubmit={handleUploadSubmit} className="space-y-3.5 text-left">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-bold text-ink uppercase tracking-wide">Upload PDF / TXT File</span>
                    <button 
                      type="button" 
                      onClick={() => setShowUploadForm(false)}
                      className="text-xs text-muted hover:text-ink cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-muted uppercase tracking-wider block">Contract Type</label>
                    <select
                      value={uploadType}
                      onChange={(e: any) => setUploadType(e.target.value)}
                      className="w-full bg-white border border-[#E5E0DA] text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-[#cc785c] cursor-pointer"
                    >
                      <option value="nda">Non-Disclosure Agreement</option>
                      <option value="founder">Founder Equity Accord</option>
                      <option value="client">Client Service Agreement</option>
                      <option value="employment">Employment Contract</option>
                      <option value="vendor">Vendor Supply Agreement</option>
                      <option value="other">Other Legal Document</option>
                    </select>
                  </div>

                  <div className="border border-dashed border-[#E5E0DA] rounded-lg p-4 text-center cursor-pointer hover:border-[#cc785c]/40 relative bg-surface-soft/10">
                    <input
                      type="file"
                      accept=".pdf,.txt"
                      onChange={handleFileChange}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                    />
                    <Upload className="w-5 h-5 text-muted-soft mx-auto mb-1" />
                    <span className="text-[10px] text-ink font-semibold block truncate">
                      {uploadFile ? uploadFile.name : 'Select PDF or Text File'}
                    </span>
                    <span className="text-[8px] text-muted-soft block mt-0.5">Maximum size 10MB</span>
                  </div>

                  <button
                    type="submit"
                    disabled={isUploading || !uploadFile}
                    className="w-full py-2 bg-[#cc785c] hover:bg-[#a9583e] text-white rounded-lg text-xs font-bold transition-all shadow-2xs cursor-pointer disabled:opacity-50"
                  >
                    {isUploading ? (
                      <span className="flex items-center justify-center gap-1">
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Uploading & Parsing...</span>
                      </span>
                    ) : (
                      <span>Upload & Review</span>
                    )}
                  </button>
                </form>
              </div>
            )}

            {/* List */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              <div className="text-[10px] font-bold text-muted-soft px-3 py-1 uppercase tracking-wider text-left">
                Agreements Registry
              </div>

              {contracts.map((c) => {
                const isSelected = selectedContractId === c.id;
                return (
                  <button
                    key={c.id}
                    onClick={() => setSelectedContractId(c.id)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all text-left cursor-pointer ${
                      isSelected
                        ? 'bg-surface-cream-strong text-ink border-l-3 border-[#cc785c]'
                        : 'hover:bg-surface-soft text-muted hover:text-ink'
                    }`}
                  >
                    <FileText className={`w-4 h-4 ${isSelected ? 'text-[#cc785c]' : 'text-muted-soft'}`} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-ink flex items-center justify-between gap-1">
                        <span>{c.name}</span>
                        {c.status === 'analyzing' && (
                          <span className="w-2 h-2 rounded-full bg-blue-500 animate-ping shrink-0" />
                        )}
                      </div>
                      <div className="text-[9px] text-muted-soft truncate mt-0.5 flex items-center justify-between">
                        <span>{getContractTypeLabel(c.contract_type)}</span>
                        {c.status === 'complete' && c.overall_score !== null && (
                          <span className={`font-bold ${
                            c.overall_score >= 80 ? 'text-[#5db872]' :
                            c.overall_score >= 50 ? 'text-[#e8a55a]' :
                            'text-[#c64545]'
                          }`}>
                            Score: {c.overall_score}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}

              {contracts.length === 0 && (
                <div className="text-center py-8 px-4 text-xs text-muted-soft italic leading-normal">
                  No contracts uploaded. Click "Upload Contract" above to begin.
                </div>
              )}
            </div>
          </div>

          {/* Right panel: Details Viewer */}
          <div className="flex-1 flex flex-col h-full overflow-hidden">
            
            {selectedContract && (
              <div className="px-6 py-4 border-b border-hairline bg-white flex justify-between items-center gap-3 shrink-0 text-left select-none">
                <div>
                  <h3 className="font-serif text-lg font-normal text-ink">
                    {selectedContract.name}
                  </h3>
                  <p className="text-[10px] text-muted-soft mt-0.5">
                    File Type: {getContractTypeLabel(selectedContract.contract_type)} • Uploaded {new Date(selectedContract.created_at).toLocaleDateString()}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {selectedContract.status === 'analyzing' && (
                    <span className="text-[9px] font-bold text-blue-700 bg-blue-50 border border-blue-200/50 px-2.5 py-0.5 rounded-full animate-pulse uppercase tracking-wide">
                      Reviewing...
                    </span>
                  )}
                  {selectedContract.status === 'failed' && (
                    <span className="text-[9px] font-bold text-red-700 bg-red-50 border border-red-200/50 px-2.5 py-0.5 rounded-full uppercase tracking-wide">
                      Parsing Failed
                    </span>
                  )}
                </div>
              </div>
            )}

            <div className="flex-1 overflow-y-auto p-6 bg-canvas flex flex-col justify-between">
              <div className="flex-1">
                {selectedContract ? (
                  selectedContract.status === 'analyzing' ? (
                    <div className="flex flex-col items-center justify-center py-20 border border-dashed border-[#E5E0DA] bg-surface-soft/10 rounded-2xl max-w-lg mx-auto text-center p-6 space-y-4">
                      <RefreshCw className="w-8 h-8 text-[#cc785c] animate-spin" />
                      <div className="space-y-1.5">
                        <h4 className="text-sm font-bold text-ink">Legal Review in Progress</h4>
                        <p className="text-xs text-muted-soft leading-normal">
                          LlamaParse is extracting layout coordinates and DeepSeek is running risk models to inspect liabilities, arbitration clauses, IP assignments, and termination rules. This takes 20-30 seconds. Watch the stream below.
                        </p>
                      </div>
                    </div>
                  ) : selectedContract.status === 'failed' ? (
                    <div className="flex flex-col items-center justify-center py-20 border border-dashed border-[#E5E0DA] bg-surface-soft/10 rounded-2xl max-w-lg mx-auto text-center p-6 space-y-4">
                      <AlertCircle className="w-8 h-8 text-[#c64545]" />
                      <div className="space-y-1.5">
                        <h4 className="text-sm font-bold text-ink">LlamaParse Ingestion Error</h4>
                        <p className="text-xs text-muted-soft leading-normal">
                          The document parsing failed. Verify the file format is valid, unencrypted, and text-readable.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <ContractAnalysis contractId={selectedContract.id} projectId={projectId} />
                  )
                ) : (
                  // Empty State
                  <div className="flex flex-col items-center justify-center py-20 max-w-md mx-auto text-center space-y-5">
                    <div className="w-16 h-16 rounded-full bg-[#cc785c]/10 flex items-center justify-center border border-[#cc785c]/20">
                      <FileCheck2 className="w-8 h-8 text-[#cc785c]" />
                    </div>

                    <div className="space-y-2">
                      <h2 className="font-serif text-2xl text-ink font-normal">Contract Intelligence</h2>
                      <p className="text-sm text-body leading-relaxed">
                        Upload standard client agreements, NDA files, or employment contracts. Run risk audits, get strategic pushback recommendations, and generate counter-proposal drafts inline.
                      </p>
                    </div>

                    <button
                      onClick={() => setShowUploadForm(true)}
                      className="px-6 py-2.5 bg-[#cc785c] hover:bg-[#a9583e] text-white rounded-lg text-xs font-bold transition-all shadow-sm cursor-pointer"
                    >
                      Upload Your First Agreement
                    </button>
                  </div>
                )}
              </div>

              {/* Stream Logs */}
              <div className="mt-8 border-t border-hairline pt-6 shrink-0 text-left">
                <h3 className="text-xs font-bold uppercase tracking-wider text-ink mb-3">Contract Review Live Agent Stream</h3>
                <LiveFeed 
                  projectId={projectId} 
                  filterTypes={[
                    StreamEventType.AGENT_STARTED,
                    StreamEventType.AGENT_THINKING,
                    StreamEventType.AGENT_COMPLETE,
                    StreamEventType.STREAM_ERROR
                  ]}
                  maxHeight="150px"
                  compact={true}
                />
              </div>

            </div>

          </div>

        </div>
      )}

    </div>
  );
}
