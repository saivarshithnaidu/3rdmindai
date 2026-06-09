'use client';

import React, { useState, useEffect } from 'react';
import {
  Image as ImageIcon,
  Download,
  ExternalLink,
  RefreshCw,
  Search,
  Filter,
  Copy,
  X,
} from 'lucide-react';
import LiveFeed from '../stream/LiveFeed';
import { StreamEventType } from '../../types';

interface GeneratedImage {
  id: string;
  project_id: string;
  agent_id: string | null;
  message_id: string | null;
  prompt: string;
  negative_prompt: string | null;
  model: string;
  width: number;
  height: number;
  image_url: string;
  storage_path: string | null;
  task_context: string | null;
  created_at: string;
}

interface ImageGalleryProps {
  projectId: string;
  userId: string;
}

export default function ImageGallery({ projectId, userId }: ImageGalleryProps) {
  const [images, setImages] = useState<GeneratedImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterAgent, setFilterAgent] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [lightboxImage, setLightboxImage] = useState<GeneratedImage | null>(null);

  const fetchImages = async () => {
    try {
      const url = filterAgent === 'all'
        ? `/api/image/list?projectId=${projectId}`
        : `/api/image/list?projectId=${projectId}&agentId=${filterAgent}`;
      
      const res = await fetch(url);
      const data = await res.json();
      if (data.success && Array.isArray(data.images)) {
        setImages(data.images);
      }
    } catch (err) {
      console.error('Failed to fetch images:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchImages();
  }, [projectId, filterAgent]);

  // Polling for new images
  useEffect(() => {
    const interval = setInterval(fetchImages, 10000);
    return () => clearInterval(interval);
  }, [projectId, filterAgent]);

  const filteredImages = images.filter((img) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      img.prompt.toLowerCase().includes(q) ||
      img.model.toLowerCase().includes(q) ||
      (img.task_context && img.task_context.toLowerCase().includes(q))
    );
  });

  // Unique agents
  const agentIds = Array.from(new Set(images.filter((i) => i.agent_id).map((i) => i.agent_id)));

  const handleDownload = (img: GeneratedImage) => {
    const a = document.createElement('a');
    a.href = img.image_url;
    a.download = `3rdmind-${img.id}.png`;
    a.target = '_blank';
    a.click();
  };

  const handleCopyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-screen bg-canvas font-dmsans">
        <RefreshCw className="w-6 h-6 text-[#cc785c] animate-spin" />
        <span className="text-xs text-muted-soft mt-2.5">Loading Image Gallery...</span>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden font-dmsans">
      {/* Filter bar */}
      <div className="px-6 py-3 bg-white border-b border-hairline flex items-center justify-between gap-4 shrink-0 select-none">
        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-2 w-3.5 h-3.5 text-muted-soft" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by prompt..."
              className="bg-[#F9F8F6] border border-[#E5E0DA] rounded-lg pl-8 pr-3 py-1.5 text-xs text-ink placeholder-[#B5B1AC] focus:outline-none focus:border-[#cc785c] w-56 font-dmsans transition-all"
            />
          </div>

          {/* Agent filter */}
          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-muted-soft" />
            <select
              value={filterAgent}
              onChange={(e) => setFilterAgent(e.target.value)}
              className="bg-white border border-[#E5E0DA] rounded-lg px-2.5 py-1.5 text-xs font-semibold text-ink focus:outline-none focus:border-[#cc785c] cursor-pointer"
            >
              <option value="all">All Sources</option>
              <option value="user">User Generated</option>
              {agentIds.map((aid) => (
                <option key={aid} value={aid || ''}>Agent: {aid?.substring(0, 8)}...</option>
              ))}
            </select>
          </div>
        </div>

        <span className="text-[10px] font-bold text-muted-soft uppercase tracking-wider">
          {filteredImages.length} image{filteredImages.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Gallery Grid */}
      <div className="flex-1 overflow-y-auto p-6 bg-canvas">
        {filteredImages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 max-w-md mx-auto text-center space-y-5">
            <div className="w-16 h-16 rounded-full bg-[#cc785c]/10 flex items-center justify-center border border-[#cc785c]/20">
              <ImageIcon className="w-8 h-8 text-[#cc785c]" />
            </div>
            <div className="space-y-2">
              <h2 className="font-serif text-2xl text-ink font-normal">Image Gallery</h2>
              <p className="text-sm text-body leading-relaxed">
                No images generated yet. Use the Image Generator in chat or let agents create visuals for your startup assets.
              </p>
            </div>
          </div>
        ) : (
          <div className="columns-2 md:columns-3 lg:columns-4 gap-4 space-y-4">
            {filteredImages.map((img) => (
              <div
                key={img.id}
                className="break-inside-avoid group relative rounded-xl overflow-hidden border border-[#E5E0DA] bg-white shadow-2xs hover:shadow-md transition-all cursor-pointer"
                onClick={() => setLightboxImage(img)}
              >
                <img
                  src={img.image_url}
                  alt={img.prompt}
                  className="w-full object-cover"
                  loading="lazy"
                />

                {/* Hover overlay */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors">
                  <div className="absolute bottom-0 left-0 right-0 p-3 opacity-0 group-hover:opacity-100 transition-opacity">
                    <p className="text-[10px] text-white/90 line-clamp-2 mb-2 leading-relaxed">{img.prompt}</p>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[8px] font-bold text-white/70 bg-white/20 px-1.5 py-0.5 rounded-full uppercase backdrop-blur-sm">
                          {img.model}
                        </span>
                        <span className="text-[8px] text-white/60">{img.width}×{img.height}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDownload(img); }}
                          className="p-1 bg-white/20 hover:bg-white/30 rounded-md text-white backdrop-blur-sm transition-colors cursor-pointer"
                        >
                          <Download className="w-3 h-3" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleCopyUrl(img.image_url); }}
                          className="p-1 bg-white/20 hover:bg-white/30 rounded-md text-white backdrop-blur-sm transition-colors cursor-pointer"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Agent badge */}
                {img.agent_id && (
                  <div className="absolute top-2 left-2">
                    <span className="text-[8px] font-bold text-white bg-[#cc785c] px-1.5 py-0.5 rounded-full shadow-sm">
                      AI
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Stream */}
        <div className="mt-8 border-t border-hairline pt-6 shrink-0 text-left">
          <h3 className="text-xs font-bold uppercase tracking-wider text-ink mb-3">Image Generation Stream</h3>
          <LiveFeed
            projectId={projectId}
            filterTypes={[
              StreamEventType.AGENT_STARTED,
              StreamEventType.AGENT_THINKING,
              StreamEventType.AGENT_COMPLETE,
              StreamEventType.STREAM_ERROR,
            ]}
            maxHeight="150px"
            compact={true}
          />
        </div>
      </div>

      {/* Lightbox */}
      {lightboxImage && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-6"
          onClick={() => setLightboxImage(null)}
        >
          <div className="relative max-w-5xl max-h-[90vh] w-full" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setLightboxImage(null)}
              className="absolute -top-10 right-0 p-2 text-white/80 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <img
              src={lightboxImage.image_url}
              alt={lightboxImage.prompt}
              className="w-full h-full object-contain rounded-xl"
            />

            <div className="mt-4 flex items-center justify-between">
              <div className="flex-1 min-w-0 mr-4">
                <p className="text-xs text-white/80 line-clamp-2">{lightboxImage.prompt}</p>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="text-[9px] font-bold text-white/60 bg-white/10 px-2 py-0.5 rounded-full">
                    {lightboxImage.model}
                  </span>
                  <span className="text-[9px] text-white/50">
                    {lightboxImage.width}×{lightboxImage.height}
                  </span>
                  <span className="text-[9px] text-white/50">
                    {new Date(lightboxImage.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => handleCopyUrl(lightboxImage.image_url)}
                  className="px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-xs text-white font-semibold transition-colors cursor-pointer flex items-center gap-1"
                >
                  <Copy className="w-3 h-3" />
                  Copy URL
                </button>
                <button
                  onClick={() => handleDownload(lightboxImage)}
                  className="px-3 py-1.5 bg-white hover:bg-white/90 rounded-lg text-xs text-[#191919] font-semibold transition-colors cursor-pointer flex items-center gap-1"
                >
                  <Download className="w-3 h-3" />
                  Download
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
