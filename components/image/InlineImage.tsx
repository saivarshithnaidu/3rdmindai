'use client';

import React from 'react';
import { Download, ExternalLink } from 'lucide-react';

interface InlineImageProps {
  imageUrl: string;
  prompt?: string;
  width?: number;
  height?: number;
  model?: string;
}

export default function InlineImage({ imageUrl, prompt, width, height, model }: InlineImageProps) {
  const [expanded, setExpanded] = React.useState(false);
  const [showPrompt, setShowPrompt] = React.useState(false);

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    const a = document.createElement('a');
    a.href = imageUrl;
    a.download = `3rdmind-image.png`;
    a.target = '_blank';
    a.click();
  };

  return (
    <div className="my-3 max-w-full">
      {/* Image Container */}
      <div
        className="relative group rounded-xl overflow-hidden border border-[#E5E0DA] bg-[#F9F8F6] cursor-pointer shadow-2xs hover:shadow-sm transition-all"
        onClick={() => setExpanded(!expanded)}
        style={{ maxHeight: expanded ? 'none' : '400px' }}
      >
        <img
          src={imageUrl}
          alt={prompt || 'Generated image'}
          className="w-full object-contain"
          style={{ maxHeight: expanded ? 'none' : '400px' }}
        />

        {/* Hover overlay */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-end">
          <div className="w-full p-3 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              {model && (
                <span className="text-[9px] font-bold text-white/80 bg-white/20 px-2 py-0.5 rounded-full uppercase backdrop-blur-sm">
                  {model}
                </span>
              )}
              {width && height && (
                <span className="text-[9px] text-white/70 font-medium">
                  {width}×{height}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleDownload}
                className="p-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-white backdrop-blur-sm transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
              </button>
              <a
                href={imageUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="p-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-white backdrop-blur-sm transition-colors cursor-pointer"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Prompt text */}
      {prompt && (
        <div className="mt-1.5">
          <button
            onClick={() => setShowPrompt(!showPrompt)}
            className="text-[9px] font-bold text-muted-soft hover:text-muted transition-colors cursor-pointer"
          >
            {showPrompt ? '▾ Hide prompt' : '▸ Show prompt'}
          </button>
          {showPrompt && (
            <p className="text-[10px] text-muted-soft leading-relaxed mt-1 px-2 py-1.5 bg-[#F9F8F6] border border-[#E5E0DA] rounded-lg">
              {prompt}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
