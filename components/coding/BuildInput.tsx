'use client';

import React, { useState, useEffect } from 'react';
import { CodeTemplate } from '../../types/coding';

interface BuildInputProps {
  projectId: string;
  userId?: string;
  onBuildStarted: (sessionId: string) => void;
  onClose: () => void;
  templates: CodeTemplate[];
}

export default function BuildInput({
  projectId,
  userId = '00000000-0000-0000-0000-000000000000',
  onBuildStarted,
  onClose,
  templates
}: BuildInputProps) {
  const [step, setStep] = useState(1);
  const [description, setDescription] = useState('');
  
  // Configuration
  const [language, setLanguage] = useState('typescript');
  const [framework, setFramework] = useState('nextjs');
  const [isDetecting, setIsDetecting] = useState(false);
  const [detectedStackText, setDetectedStackText] = useState('');

  // Advanced toggles
  const [includeTests, setIncludeTests] = useState(true);
  const [includeDocker, setIncludeDocker] = useState(false);
  const [includeCI, setIncludeCI] = useState(false);
  const [codeStyle, setCodeStyle] = useState<'clean' | 'verbose' | 'minimal'>('clean');
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Build / Plan state
  const [isPlanning, setIsPlanning] = useState(false);
  const [plan, setPlan] = useState<any>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Debounced auto-detection of stack
  useEffect(() => {
    if (description.length < 15) {
      setDetectedStackText('');
      return;
    }

    const delay = setTimeout(async () => {
      setIsDetecting(true);
      try {
        const res = await fetch('/api/coding/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            description,
            mode: 'build',
            projectId,
            userId,
            // Skip queueing build in auto-detect by passing dryRun: true or similar,
            // or simply just do a local simple regex parser first to avoid wasting tokens on keystroke
          })
        });
        
        // Simple heuristic detection client-side to be fast and token-efficient:
        const descLower = description.toLowerCase();
        let detectedLang = 'typescript';
        let detectedFrame = 'nextjs';
        
        if (descLower.includes('python') || descLower.includes('fastapi') || descLower.includes('flask') || descLower.includes('django')) {
          detectedLang = 'python';
          detectedFrame = descLower.includes('fastapi') ? 'fastapi' : descLower.includes('django') ? 'django' : 'flask';
        } else if (descLower.includes('rust') || descLower.includes('cargo')) {
          detectedLang = 'rust';
          detectedFrame = 'actix';
        } else if (descLower.includes('go ') || descLower.includes('golang') || descLower.includes('gin ')) {
          detectedLang = 'go';
          detectedFrame = 'gin';
        } else if (descLower.includes('react') || descLower.includes('vite')) {
          detectedLang = 'typescript';
          detectedFrame = 'react';
        } else if (descLower.includes('node') || descLower.includes('express')) {
          detectedLang = 'javascript';
          detectedFrame = 'express';
        } else if (descLower.includes('html') || descLower.includes('css')) {
          detectedLang = 'html';
          detectedFrame = 'vanilla';
        }

        setLanguage(detectedLang);
        setFramework(detectedFrame);
        setDetectedStackText(`Detected: ${detectedLang.toUpperCase()} + ${detectedFrame.toUpperCase()}`);
      } catch (err) {
        console.warn('Silent stack detection failed:', err);
      } finally {
        setIsDetecting(false);
      }
    }, 1200);

    return () => clearTimeout(delay);
  }, [description, projectId, userId]);

  const selectTemplate = (template: CodeTemplate) => {
    setDescription(template.description);
    if (template.stack && template.stack.length > 0) {
      const primaryLang = template.stack[0].toLowerCase();
      setLanguage(primaryLang.includes('next') || primaryLang.includes('react') ? 'typescript' : primaryLang.includes('python') ? 'python' : 'javascript');
      setFramework(template.stack[0].toLowerCase());
    }
    setStep(2);
  };

  const handleNextToStep3 = async () => {
    setIsPlanning(true);
    setError(null);
    try {
      const res = await fetch('/api/coding/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description,
          mode: 'build',
          language,
          framework,
          projectId,
          userId,
          advancedOptions: {
            includeTests,
            includeDocker,
            includeCI,
            codeStyle
          }
        })
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Failed to initialize session and plan project');
      }

      setSessionId(data.sessionId);
      setPlan(data.plan);
      setStep(3);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsPlanning(false);
    }
  };

  const handleConfirmBuild = () => {
    if (sessionId) {
      onBuildStarted(sessionId);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in font-dmsans select-none">
      <div className="bg-white border border-[#E5E0DA] rounded-2xl max-w-lg w-full p-6 shadow-xl space-y-5 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#F4F0EB] pb-3 shrink-0">
          <h3 className="font-lora text-base font-bold text-[#191919] flex items-center gap-2">
            <i className="ti ti-hammer text-base text-[#cc785c]" />
            Build Project
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-[#85827D] hover:text-[#191919] transition-colors p-1 cursor-pointer"
          >
            <i className="ti ti-x text-sm" />
          </button>
        </div>

        {/* Progress Tracker */}
        <div className="flex items-center justify-between px-1 text-xs shrink-0 select-none">
          <span className={`font-semibold ${step === 1 ? 'text-[#cc785c]' : 'text-[#85827D]'}`}>1. Describe</span>
          <i className="ti ti-chevron-right text-[10px] text-[#85827D]" />
          <span className={`font-semibold ${step === 2 ? 'text-[#cc785c]' : 'text-[#85827D]'}`}>2. Configure</span>
          <i className="ti ti-chevron-right text-[10px] text-[#85827D]" />
          <span className={`font-semibold ${step === 3 ? 'text-[#cc785c]' : 'text-[#85827D]'}`}>3. Build</span>
        </div>

        {/* Step Contents */}
        <div className="flex-1 overflow-y-auto px-1 space-y-4">
          {step === 1 && (
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-[#85827D] uppercase">What do you want to build?</label>
                <textarea
                  rows={4}
                  placeholder="Describe your software requirement in plain English..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full text-xs border border-[#E5E0DA] rounded-xl p-3 bg-[#FFFFFF] outline-none text-[#191919] resize-none focus:border-[#cc785c] focus:shadow-2xs transition-all"
                />
                <div className="flex justify-between items-center text-[10px] text-[#85827D] mt-1 select-none">
                  <span>Minimum 15 characters.</span>
                  {isDetecting ? (
                    <span className="flex items-center gap-1">
                      <i className="ti ti-loader animate-spin text-[10px]" />
                      Analyzing stack...
                    </span>
                  ) : (
                    detectedStackText && <span className="text-green-600 font-semibold">{detectedStackText}</span>
                  )}
                </div>
              </div>

              {/* Templates */}
              <div className="space-y-2 select-none">
                <label className="text-[10px] font-bold text-[#85827D] uppercase">Or start from a template</label>
                <div className="grid grid-cols-2 gap-2.5 max-h-[200px] overflow-y-auto pr-1">
                  {templates.slice(0, 4).map(t => (
                    <button
                      key={t.id}
                      onClick={() => selectTemplate(t)}
                      className="text-left p-3 border border-[#E5E0DA] hover:border-[#cc785c]/40 hover:bg-[#F9F8F6] rounded-xl transition-all cursor-pointer flex flex-col justify-between"
                    >
                      <div>
                        <div className="text-xs font-bold text-[#191919] truncate">{t.name}</div>
                        <p className="text-[9px] text-[#85827D] line-clamp-2 mt-1 leading-normal">{t.description}</p>
                      </div>
                      <div className="flex flex-wrap gap-1 mt-2.5">
                        {t.stack.slice(0, 2).map(s => (
                          <span key={s} className="text-[8px] bg-[#F4F0EB] text-[#5E5B56] px-1.5 py-0.5 rounded font-medium">{s}</span>
                        ))}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-[#85827D] uppercase">Language</label>
                  <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    className="w-full text-xs border border-[#E5E0DA] rounded-lg p-2.5 bg-[#FFFFFF] outline-none text-[#191919]"
                  >
                    <option value="typescript">TypeScript</option>
                    <option value="javascript">JavaScript</option>
                    <option value="python">Python</option>
                    <option value="rust">Rust</option>
                    <option value="go">Go</option>
                    <option value="html">HTML / CSS</option>
                    <option value="sql">SQL</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-[#85827D] uppercase">Framework</label>
                  <input
                    type="text"
                    placeholder="Next.js, Express, FastAPI, etc."
                    value={framework}
                    onChange={(e) => setFramework(e.target.value)}
                    className="w-full text-xs border border-[#E5E0DA] rounded-lg p-2.5 bg-[#FFFFFF] outline-none text-[#191919]"
                  />
                </div>
              </div>

              {/* Advanced toggles */}
              <div className="border border-[#E5E0DA] rounded-xl overflow-hidden select-none">
                <button
                  type="button"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="w-full flex items-center justify-between p-3.5 bg-[#F9F8F6] text-xs font-semibold text-[#191919] hover:bg-[#F4F0EB] transition-colors cursor-pointer"
                >
                  <span>Advanced Configuration</span>
                  <i className={`ti ${showAdvanced ? 'ti-chevron-up' : 'ti-chevron-down'} text-[#85827D]`} />
                </button>
                {showAdvanced && (
                  <div className="p-4 space-y-3.5 border-t border-[#E5E0DA] bg-white divide-y divide-[#F4F0EB]">
                    <div className="flex items-center justify-between py-1">
                      <div>
                        <span className="text-xs font-bold text-[#191919]">Generate Test Files</span>
                        <p className="text-[9px] text-[#85827D] mt-0.5">Generate unit tests for all core business logic.</p>
                      </div>
                      <input
                        type="checkbox"
                        checked={includeTests}
                        onChange={(e) => setIncludeTests(e.target.checked)}
                        className="w-4 h-4 accent-[#cc785c]"
                      />
                    </div>
                    <div className="flex items-center justify-between pt-3 pb-1">
                      <div>
                        <span className="text-xs font-bold text-[#191919]">Include Docker support</span>
                        <p className="text-[9px] text-[#85827D] mt-0.5">Generate Dockerfile and compose setups.</p>
                      </div>
                      <input
                        type="checkbox"
                        checked={includeDocker}
                        onChange={(e) => setIncludeDocker(e.target.checked)}
                        className="w-4 h-4 accent-[#cc785c]"
                      />
                    </div>
                    <div className="flex items-center justify-between pt-3 pb-1">
                      <div>
                        <span className="text-xs font-bold text-[#191919]">Include GitHub Actions CI/CD</span>
                        <p className="text-[9px] text-[#85827D] mt-0.5">Create CI pipelines for automatic tests.</p>
                      </div>
                      <input
                        type="checkbox"
                        checked={includeCI}
                        onChange={(e) => setIncludeCI(e.target.checked)}
                        className="w-4 h-4 accent-[#cc785c]"
                      />
                    </div>
                    <div className="flex items-center justify-between pt-3 pb-1">
                      <div>
                        <span className="text-xs font-bold text-[#191919]">Coding Style</span>
                        <p className="text-[9px] text-[#85827D] mt-0.5">Control verbose logging and code structure density.</p>
                      </div>
                      <select
                        value={codeStyle}
                        onChange={(e) => setCodeStyle(e.target.value as any)}
                        className="text-xs border border-[#E5E0DA] rounded p-1 outline-none text-[#191919] bg-white cursor-pointer"
                      >
                        <option value="clean">Clean (balanced)</option>
                        <option value="verbose">Verbose (fully documented)</option>
                        <option value="minimal">Minimal (compact, terse)</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {step === 3 && plan && (
            <div className="space-y-4 select-none">
              <div className="bg-[#F9F8F6] border border-[#E5E0DA] rounded-xl p-4 space-y-3 shadow-4xs">
                <h4 className="text-xs font-bold text-[#191919] flex items-center gap-1.5 border-b border-[#E5E0DA] pb-2">
                  <i className="ti ti-map-pin text-[#cc785c]" />
                  Planned File Structure
                </h4>
                <div className="bg-white border border-[#E5E0DA] rounded-lg p-3 max-h-[160px] overflow-y-auto">
                  <pre className="text-[10px] text-[#5E5B56] font-mono leading-relaxed">
                    {plan.folder_structure}
                  </pre>
                </div>
                <div className="flex justify-between items-center text-[10px] text-[#5E5B56] pt-1">
                  <span>Estimated files to generate: <strong className="text-[#cc785c]">{plan.files?.length || 0}</strong></span>
                  <span>Setup commands: <strong className="text-[#191919]">{plan.setup_commands?.length || 0}</strong></span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="flex gap-2.5 pt-3 border-t border-[#F4F0EB] shrink-0 select-none">
          {step > 1 && (
            <button
              onClick={() => setStep(step - 1)}
              className="flex-1 bg-white hover:bg-[#F9F8F6] border border-[#E5E0DA] text-[#191919] text-xs py-2 rounded-full font-medium transition-colors cursor-pointer"
            >
              Back
            </button>
          )}

          {error && (
            <div className="text-[10px] text-red-600 bg-red-50 p-2 rounded border border-red-100 flex-1 text-center truncate">
              {error}
            </div>
          )}

          {step === 1 && (
            <button
              onClick={() => setStep(2)}
              disabled={description.length < 15}
              className="flex-1 bg-[#cc785c] hover:bg-[#a9583e] text-white text-xs py-2 rounded-full font-semibold transition-colors disabled:opacity-50 cursor-pointer shadow-2xs"
            >
              Configure Stack
            </button>
          )}

          {step === 2 && (
            <button
              onClick={handleNextToStep3}
              disabled={isPlanning}
              className="flex-1 flex items-center justify-center gap-1.5 bg-[#cc785c] hover:bg-[#a9583e] text-white text-xs py-2 rounded-full font-semibold transition-colors disabled:opacity-50 cursor-pointer shadow-2xs"
            >
              {isPlanning ? (
                <>
                  <i className="ti ti-loader animate-spin text-xs" />
                  <span>Planning architecture...</span>
                </>
              ) : (
                <>
                  <span>Create Build Plan</span>
                </>
              )}
            </button>
          )}

          {step === 3 && (
            <button
              onClick={handleConfirmBuild}
              className="flex-1 bg-[#cc785c] hover:bg-[#a9583e] text-white text-xs py-2 rounded-full font-semibold transition-colors cursor-pointer shadow-2xs"
            >
              Confirm & Start Build
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
