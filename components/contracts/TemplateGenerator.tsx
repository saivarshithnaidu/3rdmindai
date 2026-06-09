'use client';

import React, { useState } from 'react';
import { 
  FileText, 
  Sparkles, 
  Copy, 
  Check, 
  Download, 
  HelpCircle,
  RefreshCw,
  ArrowRight
} from 'lucide-react';

interface TemplateGeneratorProps {
  projectId: string;
}

const TEMPLATE_OPTIONS = [
  { type: 'nda', label: 'Non-Disclosure Agreement (NDA)', desc: 'Mutual or one-way confidentiality agreements for vendors, hires, or partners.' },
  { type: 'founder', label: 'Co-Founder Equity Accord', desc: 'Detailing vesting rules, intellectual property assignments, and role distributions.' },
  { type: 'client', label: 'Client Services Agreement', desc: 'Standard master services agreement (MSA) for SaaS or consulting deliveries in India.' },
  { type: 'employment', label: 'Startup Employment Contract', desc: 'Letter of employment covering confidentiality, IP transfer, and notice periods.' },
  { type: 'vendor', label: 'Vendor Supply Agreement', desc: 'Standard service level and supply contract for third-party service providers.' },
  { type: 'other', label: 'Privacy Policy & Terms', desc: 'Standard compliance documents for Indian websites and mobile apps.' }
];

export default function TemplateGenerator({ projectId }: TemplateGeneratorProps) {
  const [selectedType, setSelectedType] = useState('nda');
  const [companyName, setCompanyName] = useState('');
  const [context, setContext] = useState('');
  const [generating, setGenerating] = useState(false);
  const [generatedTemplate, setGeneratedTemplate] = useState<any>(null);
  
  // Interactive variables values filled by user after generation
  const [variableValues, setVariableValues] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState(false);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setGenerating(true);
    setGeneratedTemplate(null);
    setVariableValues({});

    try {
      const res = await fetch('/api/contracts/template', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateType: selectedType,
          projectId,
          variables: {
            companyName,
            context
          }
        })
      });
      const data = await res.json();
      if (data.success && data.template) {
        setGeneratedTemplate(data.template);
        // Initialize interactive inputs for all extracted variables
        const initialVals: Record<string, string> = {};
        if (Array.isArray(data.template.variables)) {
          data.template.variables.forEach((v: string) => {
            initialVals[v] = '';
          });
        }
        setVariableValues(initialVals);
      } else {
        alert(`Failed to generate: ${data.error || 'Unknown error'}`);
      }
    } catch (err) {
      console.error('Failed template generation:', err);
      alert('Error generating template.');
    } finally {
      setGenerating(false);
    }
  };

  const handleVarChange = (name: string, val: string) => {
    setVariableValues(prev => ({
      ...prev,
      [name]: val
    }));
  };

  // Compile final document text replacing variables
  const getCompiledText = () => {
    if (!generatedTemplate) return '';
    let text = generatedTemplate.content;
    Object.entries(variableValues).forEach(([name, val]) => {
      if (val.trim()) {
        // Replace all instances of [NAME] or [NAME ]
        const escaped = name.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        const regex = new RegExp(`\\[${escaped}\\]`, 'g');
        text = text.replace(regex, val);
      }
    });
    return text;
  };

  const handleCopy = () => {
    const text = getCompiledText();
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const text = getCompiledText();
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${selectedType}_template_draft.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 font-dmsans text-left pb-12">
      
      {!generatedTemplate ? (
        // Step 1: Input Setup Form
        <div className="bg-white border border-[#E5E0DA] rounded-2xl p-6 shadow-2xs max-w-xl mx-auto space-y-6">
          <div>
            <h3 className="font-serif text-2xl font-normal text-ink">Generate Startup Contracts (India)</h3>
            <p className="text-xs text-muted mt-1 leading-normal">
              Choose a standard template type and provide your startup parameters to generate fully detailed agreements aligned to Indian corporate regulations and arbitration procedures.
            </p>
          </div>

          <form onSubmit={handleGenerate} className="space-y-4">
            {/* Template type selection */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-ink uppercase tracking-wide block">Template Document Type</label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {TEMPLATE_OPTIONS.map((opt) => (
                  <button
                    key={opt.type}
                    type="button"
                    onClick={() => setSelectedType(opt.type)}
                    className={`flex flex-col p-3.5 rounded-xl border text-left cursor-pointer transition-all ${
                      selectedType === opt.type
                        ? 'border-[#cc785c] bg-[#cc785c]/5 text-[#cc785c]'
                        : 'border-[#E5E0DA] hover:border-[#cc785c]/40 text-muted'
                    }`}
                  >
                    <span className="text-xs font-bold text-ink flex items-center gap-1.5">
                      <FileText className={`w-3.5 h-3.5 ${selectedType === opt.type ? 'text-[#cc785c]' : 'text-muted-soft'}`} />
                      {opt.label}
                    </span>
                    <span className="text-[10px] text-muted-soft mt-1 leading-normal">{opt.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Inputs */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-ink uppercase tracking-wide">Startup Company Name</label>
                <input
                  type="text"
                  placeholder="e.g. Acmo Technologies Private Limited"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="w-full bg-white border border-[#E5E0DA] text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:border-[#cc785c]"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-ink uppercase tracking-wide">Operational Context</label>
                <input
                  type="text"
                  placeholder="e.g. mobile app development / cloud consulting"
                  value={context}
                  onChange={(e) => setContext(e.target.value)}
                  className="w-full bg-white border border-[#E5E0DA] text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:border-[#cc785c]"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={generating || !companyName.trim() || !context.trim()}
              className="w-full flex items-center justify-center gap-1.5 py-3 bg-[#cc785c] hover:bg-[#a9583e] text-white rounded-xl text-xs font-bold transition-all shadow-sm disabled:opacity-50 cursor-pointer"
            >
              {generating ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Drafting legal clauses...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Draft Standard Document</span>
                </>
              )}
            </button>
          </form>
        </div>
      ) : (
        // Step 2: Document Editor & Interactive placeholder variables filling
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Left panel: fill variables inputs */}
          <div className="bg-white border border-[#E5E0DA] rounded-2xl p-5 shadow-2xs space-y-4 h-fit">
            <div>
              <h3 className="font-serif text-lg font-normal text-ink">Fill Document Fields</h3>
              <p className="text-[11px] text-muted mt-1 leading-normal">
                Extracted placeholders parsed from draft clauses. Fill them in to compile final contract preview.
              </p>
            </div>

            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
              {generatedTemplate.variables && generatedTemplate.variables.length > 0 ? (
                generatedTemplate.variables.map((v: string) => (
                  <div key={v} className="space-y-1">
                    <label className="text-[10px] font-bold text-ink uppercase tracking-wide block truncate" title={v}>
                      {v.replace(/_/g, ' ')}
                    </label>
                    <input
                      type="text"
                      placeholder={`Enter ${v.toLowerCase().replace(/_/g, ' ')}`}
                      value={variableValues[v] || ''}
                      onChange={(e) => handleVarChange(v, e.target.value)}
                      className="w-full bg-white border border-[#E5E0DA] text-xs rounded-lg px-2.5 py-2 focus:outline-none focus:border-[#cc785c] text-ink"
                    />
                  </div>
                ))
              ) : (
                <div className="text-xs text-muted-soft italic">No variable fields found. Ready to print.</div>
              )}
            </div>

            <div className="pt-2 border-t border-hairline flex flex-col gap-2">
              <button
                onClick={handleCopy}
                className="w-full flex items-center justify-center gap-1.5 py-2 border border-[#E5E0DA] hover:bg-surface-soft text-ink rounded-lg text-xs font-semibold cursor-pointer transition-all"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-[#5db872]" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied Final' : 'Copy Final Contract'}</span>
              </button>

              <button
                onClick={handleDownload}
                className="w-full flex items-center justify-center gap-1.5 py-2 bg-[#cc785c] hover:bg-[#a9583e] text-white rounded-lg text-xs font-bold cursor-pointer transition-all"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download Document</span>
              </button>

              <button
                onClick={() => setGeneratedTemplate(null)}
                className="w-full text-center text-xs text-muted hover:text-ink cursor-pointer pt-2"
              >
                ← Back to Selection
              </button>
            </div>
          </div>

          {/* Right panel: preview compiler */}
          <div className="lg:col-span-2 bg-white border border-[#E5E0DA] rounded-2xl p-6 shadow-2xs space-y-4">
            <div className="flex justify-between items-center border-b border-hairline pb-3">
              <div>
                <h4 className="font-serif text-lg font-normal text-ink">
                  {TEMPLATE_OPTIONS.find(t => t.type === selectedType)?.label || 'Contract Preview'}
                </h4>
                <p className="text-[10px] text-muted-soft mt-0.5">
                  Live compiled layout. Variable fields filled will highlight dynamically.
                </p>
              </div>
            </div>

            {/* Contract Body Render */}
            <div className="whitespace-pre-wrap font-serif text-sm text-body leading-relaxed bg-[#FFFFFF] border border-[#E5E0DA] rounded-xl p-6 max-h-[500px] overflow-y-auto max-w-none text-left">
              {getCompiledText()}
            </div>
          </div>

        </div>
      )}

      {/* Prominent Legal Disclaimer */}
      <div className="bg-amber-50/25 border border-amber-200/50 rounded-2xl p-4 flex gap-3.5 max-w-xl mx-auto">
        <HelpCircle className="w-5 h-5 text-[#e8a55a] shrink-0 mt-0.5" />
        <div>
          <span className="font-bold text-ink uppercase tracking-wide text-[10px] block mb-1">Important Compliance Notice</span>
          <p className="text-muted-soft leading-relaxed text-xs">
            Standard India contract templates are generated automatically for operational scaffolding. They do NOT establish an attorney-client relationship and do not substitute for custom counsel. Please consult a qualified lawyer under Indian jurisdiction to verify liabilities, governing jurisdictions, and arbitration structures before execution.
          </p>
        </div>
      </div>

    </div>
  );
}
