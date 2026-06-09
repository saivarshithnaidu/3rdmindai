'use client';

import React from 'react';
import dynamic from 'next/dynamic';

const MonacoEditor = dynamic(() => import('@monaco-editor/react'), { ssr: false });

interface CodeEditorProps {
  filePath: string | null;
  content: string;
  onChange?: (val: string) => void;
  readOnly?: boolean;
  openFiles?: string[];
  activeTab?: string | null;
  onTabSelect?: (path: string) => void;
  onTabClose?: (path: string) => void;
}

export default function CodeEditor({
  filePath,
  content,
  onChange,
  readOnly = false,
  openFiles = [],
  activeTab = null,
  onTabSelect,
  onTabClose
}: CodeEditorProps) {
  // Detect language for Monaco Editor
  const getMonacoLanguage = (path: string | null) => {
    if (!path) return 'javascript';
    const ext = path.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'ts':
      case 'tsx':
        return 'typescript';
      case 'js':
      case 'jsx':
        return 'javascript';
      case 'py':
        return 'python';
      case 'css':
        return 'css';
      case 'html':
        return 'html';
      case 'json':
        return 'json';
      case 'sql':
        return 'sql';
      case 'md':
        return 'markdown';
      case 'sh':
      case 'bash':
        return 'shell';
      case 'yml':
      case 'yaml':
        return 'yaml';
      case 'rs':
        return 'rust';
      case 'go':
        return 'go';
      case 'java':
        return 'java';
      case 'php':
        return 'php';
      default:
        return 'plaintext';
    }
  };

  const handleEditorChange = (value: string | undefined) => {
    if (onChange && value !== undefined) {
      onChange(value);
    }
  };

  const currentLanguage = getMonacoLanguage(filePath);
  const lineCount = content.split('\n').length;
  const fileSize = Math.round(new Blob([content]).size);

  return (
    <div className="flex flex-col h-full bg-[#1e1e1e] rounded-xl overflow-hidden border border-[#2d2d2d] shadow-sm select-none">
      {/* Tab bar */}
      <div className="flex items-center justify-between bg-[#252526] border-b border-[#2d2d2d] px-2 h-10 select-none">
        <div className="flex items-center overflow-x-auto gap-0.5 no-scrollbar scroll-smooth flex-1 h-full pt-1.5">
          {openFiles.map(path => {
            const isActive = activeTab === path;
            const filename = path.split('/').pop() || path;
            return (
              <div
                key={path}
                onClick={() => onTabSelect && onTabSelect(path)}
                className={`flex items-center gap-1.5 px-3 py-1 text-xs rounded-t-lg cursor-pointer transition-all duration-150 shrink-0 h-full border-t border-x ${
                  isActive
                    ? 'bg-[#1e1e1e] text-[#FFFFFF] border-[#cc785c]/40 font-semibold'
                    : 'bg-[#2d2d2d]/60 text-[#85827D] border-[#2d2d2d] hover:bg-[#2d2d2d] hover:text-[#c5c5c5]'
                }`}
              >
                <span className="truncate max-w-[120px]">{filename}</span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onTabClose) onTabClose(path);
                  }}
                  className="hover:bg-[#3d3d3d] hover:text-[#FFFFFF] text-[#85827D] rounded p-0.5 leading-none transition-colors"
                >
                  <i className="ti ti-x text-[10px]" />
                </button>
              </div>
            );
          })}
          {openFiles.length === 0 && (
            <div className="text-[11px] text-[#5E5B56] px-2 italic select-none">
              No files open
            </div>
          )}
        </div>
      </div>

      {/* Editor container */}
      <div className="flex-1 min-h-0 relative">
        {filePath ? (
          <MonacoEditor
            height="100%"
            language={currentLanguage}
            theme="vs-dark"
            value={content}
            onChange={handleEditorChange}
            options={{
              readOnly: readOnly,
              fontSize: 13,
              fontFamily: 'Consolas, "Courier New", monospace',
              minimap: { enabled: true },
              scrollBeyondLastLine: false,
              automaticLayout: true,
              wordWrap: 'on',
              lineNumbers: 'on',
              folding: true,
              cursorBlinking: 'smooth',
              cursorSmoothCaretAnimation: 'on',
              smoothScrolling: true,
              padding: { top: 12, bottom: 12 }
            }}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-[#85827D] select-none p-6 text-center">
            <i className="ti ti-code-circle text-4xl mb-2 text-[#4d4d4d]" />
            <h3 className="text-sm font-semibold text-[#c5c5c5]">No file open</h3>
            <p className="text-xs text-[#5E5B56] mt-1 max-w-[240px]">
              Select a file from the file tree on the left to start viewing or editing.
            </p>
          </div>
        )}
      </div>

      {/* Bottom status bar */}
      <div className="bg-[#007acc] text-[#FFFFFF] text-xs px-3 py-1 flex items-center justify-between select-none h-6 font-dmsans">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <i className="ti ti-terminal text-[11px]" />
            {readOnly ? (
              <span className="font-semibold flex items-center gap-1 animate-pulse">
                <span className="w-1.5 h-1.5 bg-yellow-400 rounded-full"></span>
                Agent writing...
              </span>
            ) : (
              <span className="font-medium">Ready to edit</span>
            )}
          </span>
          <span className="text-[#a6d5fa]">|</span>
          <span className="truncate max-w-[300px]">{filePath || 'No file selected'}</span>
        </div>
        <div className="flex items-center gap-3">
          <span>{currentLanguage.toUpperCase()}</span>
          <span>{lineCount} lines</span>
          <span>{(fileSize / 1024).toFixed(2)} KB</span>
        </div>
      </div>
    </div>
  );
}
