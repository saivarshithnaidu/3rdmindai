import React from 'react';
import { Loader2 } from 'lucide-react';

interface ArtifactRendererProps {
  code: string;
  title: string;
}

export default function ArtifactRenderer({ code, title }: ArtifactRendererProps) {
  if (!code) {
    return (
      <div className="w-full h-full bg-[#FAF8F5] flex flex-col items-center justify-center p-8 text-center select-none animate-fadeIn">
        <div className="w-full max-w-[260px] p-5 rounded-2xl bg-white border border-[#E5E0DA] shadow-xs flex flex-col items-center gap-4 animate-pulse">
          <div className="bg-[#EBE5DC]/55 border border-[#E5E0DA]/70 p-2.5 rounded-full text-[#5E5B56]">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
          
          <div className="w-full space-y-2.5">
            <div className="h-4 bg-[#EBE5DC] rounded-md w-3/4 mx-auto" />
            <div className="h-3 bg-[#FAF8F5] border border-[#E5E0DA] rounded-md w-5/6 mx-auto" />
          </div>
          
          <div className="w-full space-y-2 pt-2">
            <div className="h-2 bg-[#EBE5DC]/50 rounded-sm w-full" />
            <div className="h-2 bg-[#EBE5DC]/50 rounded-sm w-11/12" />
            <div className="h-2 bg-[#EBE5DC]/50 rounded-sm w-4/5" />
          </div>
          
          <span className="text-[10px] text-[#85827D] font-bold uppercase tracking-wider font-dmsans flex items-center gap-1.5 mt-1">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-600" />
            Compiling Sandbox...
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full bg-white relative overflow-hidden flex flex-col border border-[#E5E0DA] rounded-xl shadow-xs">
      <iframe
        title={title}
        sandbox="allow-scripts allow-popups allow-modals"
        srcDoc={code}
        className="w-full h-full border-0 bg-white flex-1"
      />
    </div>
  );
}
