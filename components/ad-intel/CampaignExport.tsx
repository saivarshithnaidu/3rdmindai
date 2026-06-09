'use client';

import React, { useState } from 'react';
import { AdVariation } from '../../types';
import { Copy, Check, Download, FileSpreadsheet } from 'lucide-react';

interface CampaignExportProps {
  variations: AdVariation[];
  platform: string;
  campaignName: string;
}

export default function CampaignExport({ variations, platform, campaignName }: CampaignExportProps) {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);

  const copyToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const copyAllToClipboard = () => {
    const formatted = variations.map((v) => {
      return `Variation #${v.variation_number} (${v.angle})
Headline: ${v.headline}
Body: ${v.body}
CTA: ${v.cta}
---`;
    }).join('\n\n');

    navigator.clipboard.writeText(formatted);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
  };

  const downloadCSV = () => {
    const headers = ['Variation Number', 'Angle', 'Headline', 'BodyText', 'CTA', 'Why It Works', 'Inspired By'];
    const rows = variations.map((v) => [
      v.variation_number,
      `"${v.angle.replace(/"/g, '""')}"`,
      `"${v.headline.replace(/"/g, '""')}"`,
      `"${v.body.replace(/"/g, '""')}"`,
      `"${v.cta.replace(/"/g, '""')}"`,
      `"${(v.why_this_works || '').replace(/"/g, '""')}"`,
      `"${(v.inspired_by || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${campaignName.toLowerCase().replace(/\s+/g, '_')}_export.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        onClick={copyAllToClipboard}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-canvas border border-hairline hover:bg-surface-soft text-ink rounded-lg text-xs font-semibold cursor-pointer transition-colors shadow-2xs"
      >
        {copiedAll ? (
          <>
            <Check className="w-3.5 h-3.5 text-green-600" />
            <span className="text-green-700">Copied All!</span>
          </>
        ) : (
          <>
            <Copy className="w-3.5 h-3.5 text-[#cc785c]" />
            <span>Copy All Copy</span>
          </>
        )}
      </button>

      <button
        onClick={downloadCSV}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-[#cc785c] hover:bg-[#a9583e] text-white rounded-lg text-xs font-semibold cursor-pointer transition-colors shadow-sm"
      >
        <Download className="w-3.5 h-3.5" />
        <span>Export CSV</span>
      </button>
    </div>
  );
}
