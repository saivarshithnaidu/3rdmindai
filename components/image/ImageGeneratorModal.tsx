'use client';

import React, { useState } from 'react';
import {
  X,
  Sparkles,
  Download,
  RefreshCw,
  Image as ImageIcon,
  MessageSquare,
  BookmarkPlus,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface ImageGeneratorModalProps {
  projectId: string;
  userId: string;
  onClose: () => void;
  onImageGenerated?: (imageUrl: string, imageId: string) => void;
}

const STYLES = [
  { id: 'photorealistic', label: 'Photorealistic', emoji: '📷' },
  { id: 'illustration', label: 'Illustration', emoji: '🎨' },
  { id: 'minimal', label: 'Minimal', emoji: '◻️' },
  { id: 'logo', label: 'Logo', emoji: '💎' },
  { id: '3d', label: '3D', emoji: '🧊' },
  { id: 'cartoon', label: 'Cartoon', emoji: '🎪' },
];

const SIZE_PRESETS = [
  { id: 'square', label: 'Square', width: 1024, height: 1024, desc: '1024×1024' },
  { id: 'landscape', label: 'Landscape', width: 1280, height: 720, desc: '1280×720' },
  { id: 'portrait', label: 'Portrait', width: 720, height: 1280, desc: '720×1280' },
  { id: 'linkedin', label: 'LinkedIn', width: 1200, height: 627, desc: '1200×627' },
  { id: 'instagram', label: 'Instagram', width: 1080, height: 1080, desc: '1080×1080' },
  { id: 'ad-banner', label: 'Ad Banner', width: 1200, height: 628, desc: '1200×628' },
  { id: 'story', label: 'Story', width: 1080, height: 1920, desc: '1080×1920' },
];

const MODELS = [
  { id: 'flux-pro', label: 'Flux Pro', desc: 'Best quality', badge: 'PRO' },
  { id: 'flux-dev', label: 'Flux Dev', desc: 'Faster, free', badge: 'FREE' },
  { id: 'sdxl', label: 'SDXL', desc: 'Photorealistic', badge: '' },
];

export default function ImageGeneratorModal({ projectId, userId, onClose, onImageGenerated }: ImageGeneratorModalProps) {
  const [prompt, setPrompt] = useState('');
  const [selectedStyle, setSelectedStyle] = useState('photorealistic');
  const [selectedSize, setSelectedSize] = useState('square');
  const [selectedModel, setSelectedModel] = useState('flux-pro');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<{ url: string; id: string } | null>(null);
  const [showPromptDetails, setShowPromptDetails] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sizePreset = SIZE_PRESETS.find((s) => s.id === selectedSize) || SIZE_PRESETS[0];

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setIsGenerating(true);
    setError(null);
    setGeneratedImage(null);

    try {
      const res = await fetch('/api/image/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: prompt.trim(),
          style: selectedStyle,
          width: sizePreset.width,
          height: sizePreset.height,
          model: selectedModel,
          projectId,
        }),
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'Generation failed');
      }

      // Poll for the image to appear in DB
      let attempts = 0;
      const maxAttempts = 60;
      while (attempts < maxAttempts) {
        await new Promise((r) => setTimeout(r, 3000));
        attempts++;

        const listRes = await fetch(`/api/image/list?projectId=${projectId}&limit=1`);
        const listData = await listRes.json();
        if (listData.success && listData.images && listData.images.length > 0) {
          const latestImage = listData.images[0];
          // Check if this is the one we just created
          const createdAt = new Date(latestImage.created_at).getTime();
          const now = Date.now();
          if (now - createdAt < 300000) {
            setGeneratedImage({ url: latestImage.image_url, id: latestImage.id });
            if (onImageGenerated) onImageGenerated(latestImage.image_url, latestImage.id);
            break;
          }
        }
      }

      if (attempts >= maxAttempts) {
        throw new Error('Image generation timed out. Check the gallery for your image.');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = () => {
    if (!generatedImage) return;
    const a = document.createElement('a');
    a.href = generatedImage.url;
    a.download = `3rdmind-${generatedImage.id}.png`;
    a.target = '_blank';
    a.click();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-[#E5E0DA]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[#E5E0DA]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#cc785c] to-[#a9583e] flex items-center justify-center">
              <ImageIcon className="w-4.5 h-4.5 text-white" />
            </div>
            <div>
              <h2 className="font-lora text-lg font-normal text-ink">Image Generator</h2>
              <p className="text-[10px] text-muted-soft">Powered by Flux AI</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-[#F4F0EB] rounded-lg text-muted cursor-pointer transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Prompt */}
          <div>
            <label className="text-[10px] font-bold text-muted uppercase tracking-wider block mb-1.5">Describe your image</label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="A professional hero image for a SaaS landing page showing a team collaborating on a futuristic dashboard..."
              className="w-full bg-[#F9F8F6] border border-[#E5E0DA] rounded-xl px-4 py-3 text-sm text-ink placeholder-[#B5B1AC] focus:outline-none focus:border-[#cc785c] focus:ring-1 focus:ring-[#cc785c]/20 resize-none font-dmsans transition-all"
              rows={3}
              disabled={isGenerating}
            />
          </div>

          {/* Style Selector */}
          <div>
            <label className="text-[10px] font-bold text-muted uppercase tracking-wider block mb-1.5">Style</label>
            <div className="flex flex-wrap gap-2">
              {STYLES.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setSelectedStyle(s.id)}
                  disabled={isGenerating}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer border ${
                    selectedStyle === s.id
                      ? 'bg-[#cc785c] text-white border-[#cc785c] shadow-sm'
                      : 'bg-white border-[#E5E0DA] text-muted hover:border-[#cc785c]/40 hover:text-ink'
                  }`}
                >
                  <span className="mr-1">{s.emoji}</span>
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Size Presets */}
          <div>
            <label className="text-[10px] font-bold text-muted uppercase tracking-wider block mb-1.5">Size</label>
            <div className="flex flex-wrap gap-2">
              {SIZE_PRESETS.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setSelectedSize(s.id)}
                  disabled={isGenerating}
                  className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all cursor-pointer border ${
                    selectedSize === s.id
                      ? 'bg-[#191919] text-white border-[#191919]'
                      : 'bg-white border-[#E5E0DA] text-muted hover:border-[#85827D] hover:text-ink'
                  }`}
                >
                  {s.label}
                  <span className="text-[9px] ml-1 opacity-60">{s.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Model Selector */}
          <div>
            <label className="text-[10px] font-bold text-muted uppercase tracking-wider block mb-1.5">Model</label>
            <div className="flex gap-2">
              {MODELS.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setSelectedModel(m.id)}
                  disabled={isGenerating}
                  className={`flex-1 px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer border text-left ${
                    selectedModel === m.id
                      ? 'bg-[#F4F0EB] border-[#cc785c] text-ink'
                      : 'bg-white border-[#E5E0DA] text-muted hover:border-[#cc785c]/40'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span>{m.label}</span>
                    {m.badge && (
                      <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full uppercase ${
                        m.badge === 'PRO' ? 'bg-[#cc785c]/15 text-[#cc785c]' : 'bg-[#5db872]/15 text-[#5db872]'
                      }`}>
                        {m.badge}
                      </span>
                    )}
                  </div>
                  <span className="text-[9px] text-muted-soft">{m.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Generate Button */}
          <button
            onClick={handleGenerate}
            disabled={isGenerating || !prompt.trim()}
            className="w-full py-3 bg-gradient-to-r from-[#cc785c] to-[#a9583e] hover:from-[#a9583e] hover:to-[#8a4530] text-white rounded-xl text-sm font-bold transition-all shadow-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isGenerating ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Generating with {MODELS.find((m) => m.id === selectedModel)?.label}...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Generate Image</span>
              </>
            )}
          </button>

          {/* Error */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-medium">
              {error}
            </div>
          )}

          {/* Generating Animation */}
          {isGenerating && !generatedImage && (
            <div className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-[#F4F0EB] to-[#E9E3DB] border border-[#E5E0DA]"
              style={{ aspectRatio: `${sizePreset.width}/${sizePreset.height}`, maxHeight: '400px' }}>
              <div className="absolute inset-0 flex flex-col items-center justify-center space-y-3">
                <div className="relative">
                  <div className="w-14 h-14 rounded-2xl bg-white/80 flex items-center justify-center shadow-sm">
                    <Sparkles className="w-6 h-6 text-[#cc785c] animate-pulse" />
                  </div>
                  <div className="absolute -inset-2 rounded-3xl border-2 border-[#cc785c]/20 animate-ping" />
                </div>
                <p className="text-xs font-semibold text-ink">Generating with {MODELS.find((m) => m.id === selectedModel)?.label}...</p>
                <p className="text-[10px] text-muted-soft">This usually takes 10-30 seconds</p>
              </div>
            </div>
          )}

          {/* Generated Image */}
          {generatedImage && (
            <div className="space-y-3">
              <div className="rounded-2xl overflow-hidden border border-[#E5E0DA] shadow-sm bg-white">
                <img
                  src={generatedImage.url}
                  alt="Generated image"
                  className="w-full object-contain"
                  style={{ maxHeight: '450px' }}
                />
              </div>

              {/* Action buttons */}
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={handleGenerate}
                  className="flex items-center gap-1.5 px-3 py-2 bg-white border border-[#E5E0DA] hover:border-[#cc785c]/40 rounded-xl text-xs font-semibold text-muted hover:text-ink transition-all cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Regenerate
                </button>
                <button
                  onClick={handleDownload}
                  className="flex items-center gap-1.5 px-3 py-2 bg-white border border-[#E5E0DA] hover:border-[#cc785c]/40 rounded-xl text-xs font-semibold text-muted hover:text-ink transition-all cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download
                </button>
                <button
                  onClick={() => {
                    if (onImageGenerated) onImageGenerated(generatedImage.url, generatedImage.id);
                    onClose();
                  }}
                  className="flex items-center gap-1.5 px-3 py-2 bg-[#cc785c] hover:bg-[#a9583e] rounded-xl text-xs font-semibold text-white transition-all cursor-pointer shadow-sm"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  Use in Chat
                </button>
                <button
                  onClick={() => {}}
                  className="flex items-center gap-1.5 px-3 py-2 bg-white border border-[#E5E0DA] hover:border-[#cc785c]/40 rounded-xl text-xs font-semibold text-muted hover:text-ink transition-all cursor-pointer"
                >
                  <BookmarkPlus className="w-3.5 h-3.5" />
                  Save to Gallery
                </button>
              </div>

              {/* Prompt details */}
              <button
                onClick={() => setShowPromptDetails(!showPromptDetails)}
                className="flex items-center gap-1 text-[10px] font-bold text-muted hover:text-ink transition-colors cursor-pointer"
              >
                {showPromptDetails ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                Prompt used
              </button>
              {showPromptDetails && (
                <div className="p-3 bg-[#F9F8F6] border border-[#E5E0DA] rounded-xl text-xs text-body leading-relaxed">
                  {prompt}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
