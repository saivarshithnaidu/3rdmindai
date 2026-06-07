'use client';

import React, { useState, useEffect } from 'react';
import { Mail, Calendar, ChevronRight, FileText, Download, RefreshCw, Printer } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface WeeklyDigestProps {
  projectId: string;
}

export default function WeeklyDigest({ projectId }: WeeklyDigestProps) {
  const [digests, setDigests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDigest, setSelectedDigest] = useState<any | null>(null);

  const loadDigests = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/digest/list?projectId=${projectId}`);
      if (res.ok) {
        const data = await res.json();
        setDigests(data.digests || []);
        if (data.digests && data.digests.length > 0 && !selectedDigest) {
          setSelectedDigest(data.digests[0]);
        }
      }
    } catch (err) {
      console.error('Failed to load weekly digests:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDigests();
  }, [projectId]);

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = (digest: any) => {
    const element = document.createElement("a");
    const file = new Blob([digest.content], { type: 'text/markdown' });
    element.href = URL.createObjectURL(file);
    element.download = `3RDMIND_Digest_${digest.week_start}.md`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  return (
    <div className="space-y-6 font-dmsans h-full flex flex-col lg:flex-row gap-6 select-none">
      
      {/* Left panel: list of digests */}
      <div className="lg:w-[240px] shrink-0 space-y-4">
        <div className="flex items-center justify-between border-b border-[#E5E0DA] pb-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#85827D] flex items-center gap-1.5">
            <Calendar className="w-4 h-4 text-[#D97757]" />
            <span>Weekly Digests</span>
          </h3>
          <button
            onClick={loadDigests}
            className="p-1 hover:bg-[#F4F0EB] text-[#5E5B56] hover:text-[#191919] rounded-lg transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>

        {loading ? (
          <div className="text-center py-6 text-xs text-[#85827D]">Loading digests...</div>
        ) : digests.length === 0 ? (
          <div className="text-center py-8 border border-dashed border-[#E5E0DA] rounded-2xl bg-[#FBF9F6]">
            <FileText className="w-6 h-6 text-[#85827D] mx-auto mb-2 opacity-50" />
            <p className="text-[11px] text-[#5E5B56] font-semibold">No digests compiled yet.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {digests.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => setSelectedDigest(d)}
                className={`w-full flex items-center justify-between p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  selectedDigest?.id === d.id
                    ? 'bg-white border-[#D97757] shadow-sm text-[#191919]'
                    : 'bg-[#FBF9F6] border-[#E5E0DA] text-[#5E5B56] hover:bg-[#F4F0EB]'
                }`}
              >
                <div>
                  <span className="text-[10px] font-extrabold block">Week of {d.week_start}</span>
                  <span className="text-[9px] text-[#85827D] font-bold block mt-0.5">
                    {d.sent_to_email ? 'Emailed to founder' : 'Drafted'}
                  </span>
                </div>
                <ChevronRight className="w-4 h-4 text-[#85827D]" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Right panel: content preview */}
      <div className="flex-1 bg-white border border-[#E5E0DA] rounded-3xl p-6 flex flex-col justify-between overflow-hidden shadow-[0_4px_16px_rgba(25,25,25,0.01)] min-h-[400px]">
        {selectedDigest ? (
          <div className="flex flex-col h-full justify-between">
            {/* Header actions */}
            <div className="flex items-center justify-between border-b border-[#F5F3EE] pb-4 mb-4">
              <div>
                <h4 className="text-sm font-extrabold text-[#191919]">Digest Preview</h4>
                <p className="text-[9px] text-[#85827D] font-semibold uppercase tracking-wider mt-0.5">Week of {selectedDigest.week_start}</p>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handlePrint}
                  className="p-2 bg-[#FBF9F6] border border-[#E5E0DA] hover:bg-[#F4F0EB] text-[#5E5B56] hover:text-[#191919] rounded-xl transition-all cursor-pointer flex items-center gap-1.5 text-xs font-bold"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print</span>
                </button>
                <button
                  onClick={() => handleDownload(selectedDigest)}
                  className="p-2 bg-[#D97757] hover:bg-[#c66545] text-white rounded-xl transition-all cursor-pointer flex items-center gap-1.5 text-xs font-bold shadow-xs"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download MD</span>
                </button>
              </div>
            </div>

            {/* Digest body rendering */}
            <div className="flex-1 overflow-y-auto pr-1 prose prose-sm max-w-none text-[#191919] text-xs leading-relaxed space-y-4">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {selectedDigest.content}
              </ReactMarkdown>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
            <FileText className="w-12 h-12 text-[#85827D] opacity-30 mb-3" />
            <h4 className="text-sm font-extrabold text-[#191919]">No Digest Selected</h4>
            <p className="text-xs text-[#5E5B56] mt-1 max-w-[250px] leading-relaxed">Select a weekly digest from the list on the left to read accomplishments summaries.</p>
          </div>
        )}
      </div>

    </div>
  );
}
