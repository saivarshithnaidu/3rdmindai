'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Message } from '../../types';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Copy, Check, ChevronDown, ChevronUp, Loader2, CheckCircle2, XCircle, ExternalLink, Download, Printer, ThumbsUp, ThumbsDown, Pencil, RotateCcw } from 'lucide-react';

interface MessageBubbleProps {
  message: Message;
  onOpenPreview?: (code: string, title: string) => void;
  onEditMessage?: (messageId: string, newContent: string) => void;
  onRegenerateMessage?: (messageId: string) => void;
}

interface ToolCallData {
  name: string;
  query: string;
  status: 'running' | 'success' | 'error';
  results: { title: string; url: string }[];
}

function ToolCallWidget({ content }: { content: string }) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  let data: ToolCallData;
  try {
    const startIdx = content.indexOf('{');
    const endIdx = content.lastIndexOf('}');
    if (startIdx === -1 || endIdx === -1 || endIdx < startIdx) {
      throw new Error("No JSON boundaries found");
    }
    const rawJson = content.substring(startIdx, endIdx + 1);
    try {
      data = JSON.parse(rawJson);
    } catch (parseErr) {
      const sanitized = rawJson
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '\\r')
        .replace(/\t/g, '\\t');
      data = JSON.parse(sanitized);
    }
  } catch (e) {
    return (
      <div className="bg-rose-50 border border-rose-200 text-rose-700 p-3 rounded-lg text-xs max-w-4xl mx-auto my-3 select-text break-all">
        Failed to parse tool call details: {content}
      </div>
    );
  }

  const { name, query, status, results } = data;

  let statusIcon;
  if (status === 'running') {
    statusIcon = <Loader2 className="w-3.5 h-3.5 animate-spin text-[#9A6B24] shrink-0" />;
  } else if (status === 'success') {
    statusIcon = <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />;
  } else {
    statusIcon = <XCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />;
  }

  let headerText = '';
  if (status === 'running') {
    headerText = `${name}: ${query || 'Running...'}`;
  } else if (status === 'success') {
    if (results.length > 0) {
      headerText = `Fetched: ${results[0].title}`;
    } else {
      headerText = `Fetched: ${query}`;
    }
  } else {
    headerText = `${name} failed`;
  }

  return (
    <div className="w-full max-w-4xl mx-auto my-3 font-dmsans select-none">
      <div className="border border-[#E5E0DA] bg-[#FFFFFF] rounded-xl overflow-hidden shadow-2xs">
        {/* Accordion Header */}
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center justify-between px-4 py-2.5 bg-[#F9F8F6] hover:bg-[#F4F0EB] transition-colors cursor-pointer text-left text-xs font-semibold text-[#191919]"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            {statusIcon}
            <span className="truncate pr-4">{headerText}</span>
          </div>
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-[#85827D] shrink-0" />
          ) : (
            <ChevronDown className="w-4 h-4 text-[#85827D] shrink-0" />
          )}
        </button>

        {/* Accordion Body */}
        {isExpanded && (
          <div className="p-3 border-t border-[#E5E0DA] bg-[#FFFFFF] flex flex-col gap-2 transition-all duration-150 animate-in fade-in slide-in-from-top-1">
            {/* Status logs */}
            <div className="flex flex-col gap-1.5 px-1 py-0.5 text-[10px] text-[#85827D] font-bold">
              {status === 'running' && (
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#9A6B24] animate-pulse" />
                  <span>Connecting to resource API...</span>
                </div>
              )}
              {status === 'success' && (
                <>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                    <span>Resource API queried successfully</span>
                  </div>
                  {results.length > 0 && (
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                      <span>Retrieved {results.length} relevant reference links</span>
                    </div>
                  )}
                </>
              )}
              {status === 'error' && (
                <div className="flex items-center gap-2 text-rose-600">
                  <XCircle className="w-3 h-3 text-rose-600 shrink-0" />
                  <span>Error fetching content. Check API logs.</span>
                </div>
              )}
            </div>

            {/* Results links */}
            {status === 'success' && results.length > 0 && (
              <div className="flex flex-col gap-1.5 border-t border-[#F4F0EB] pt-2 mt-1">
                {results.map((res, idx) => {
                  let hostname = res.url;
                  try {
                    hostname = new URL(res.url).hostname;
                  } catch(e){}

                  return (
                    <a
                      key={idx}
                      href={res.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between p-2 rounded-lg border border-[#E5E0DA] hover:border-[#C2BCB2] bg-[#FFFFFF] hover:bg-[#FDFCFB] transition-all duration-150 group"
                    >
                      <div className="flex items-center gap-2.5 min-w-0 pr-4">
                        <div className="w-6 h-6 rounded bg-[#F4F0EB] text-[#5E5B56] flex items-center justify-center font-bold text-[10px] uppercase tracking-wider shrink-0 select-none">
                          {hostname.slice(0, 2)}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-xs font-bold text-[#191919] truncate leading-tight group-hover:text-amber-800 transition-colors">
                            {res.title || 'Source Link'}
                          </span>
                          <span className="text-[9px] text-[#85827D] font-semibold truncate leading-none mt-0.5">
                            {hostname}
                          </span>
                        </div>
                      </div>
                      <ExternalLink className="w-3.5 h-3.5 text-[#85827D] group-hover:text-[#191919] transition-colors shrink-0" />
                    </a>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function mdToHtml(md: string): string {
  const lines = md.split('\n');
  let htmlLines: string[] = [];
  let inList = false;
  
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    
    // Check for headers
    if (line.startsWith('# ')) {
      if (inList) { htmlLines.push('</ul>'); inList = false; }
      htmlLines.push(`<h1>${line.substring(2).trim()}</h1>`);
      continue;
    }
    if (line.startsWith('## ')) {
      if (inList) { htmlLines.push('</ul>'); inList = false; }
      htmlLines.push(`<h2>${line.substring(3).trim()}</h2>`);
      continue;
    }
    if (line.startsWith('### ')) {
      if (inList) { htmlLines.push('</ul>'); inList = false; }
      const content = line.substring(4).trim();
      const parts = content.split('|');
      if (parts.length >= 2) {
        const left = parts[0].trim();
        const right = parts.slice(1).join(' | ').trim();
        htmlLines.push(`<h3><span>${left}</span><span class="date-location">${right}</span></h3>`);
      } else {
        htmlLines.push(`<h3>${content}</h3>`);
      }
      continue;
    }
    if (line.startsWith('#### ')) {
      if (inList) { htmlLines.push('</ul>'); inList = false; }
      htmlLines.push(`<h4>${line.substring(5).trim()}</h4>`);
      continue;
    }
    
    // Check for bullet list items
    const listMatch = line.match(/^(\s*)[-\*\+]\s+(.*)$/);
    if (listMatch) {
      const content = listMatch[2].trim();
      if (!inList) {
        htmlLines.push('<ul>');
        inList = true;
      }
      const formattedContent = content
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/`(.*?)`/g, '<code>$1</code>');
      htmlLines.push(`<li>${formattedContent}</li>`);
      continue;
    }
    
    // If we were in a list and this is not a list line, close the list
    if (inList && line.trim() === '') {
      htmlLines.push('</ul>');
      inList = false;
      continue;
    }
    
    // Horizontal rule
    if (/^\s*[-*_]{3,}\s*$/.test(line)) {
      if (inList) { htmlLines.push('</ul>'); inList = false; }
      htmlLines.push('<hr />');
      continue;
    }
    
    // Standard paragraph or empty line
    const trimmed = line.trim();
    if (trimmed) {
      if (inList) { htmlLines.push('</ul>'); inList = false; }
      const formattedLine = trimmed
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/`(.*?)`/g, '<code>$1</code>')
        .replace(/\|/g, '<span class="pipe">|</span>');
      
      htmlLines.push(`<p>${formattedLine}</p>`);
    } else {
      if (inList) { htmlLines.push('</ul>'); inList = false; }
    }
  }
  
  if (inList) {
    htmlLines.push('</ul>');
  }
  
  return htmlLines.join('\n');
}

// Custom code block renderer with Vercel-style copy buttons
function CodeBlock({ language, code, onOpenPreview }: { language: string; code: string; onOpenPreview?: (code: string, title: string) => void }) {
  const [isCopied, setIsCopied] = useState(false);

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  const downloadAsFile = () => {
    try {
      const element = document.createElement("a");
      const file = new Blob([code], { type: 'text/plain;charset=utf-8' });
      element.href = URL.createObjectURL(file);
      
      let extension = 'txt';
      if (language === 'markdown' || language === 'md') {
        extension = 'md';
      } else if (language === 'html') {
        extension = 'html';
      }
      
      element.download = `tailored_resume.${extension}`;
      document.body.appendChild(element);
      element.click();
      document.body.removeChild(element);
    } catch (err) {
      console.error('Failed to download file: ', err);
    }
  };

  const downloadAsPdf = () => {
    try {
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        alert("Pop-up blocker is enabled. Please allow pop-ups for this site to print PDF.");
        return;
      }
      
      let rawHtml = code;
      if (language === 'markdown' || language === 'md' || !language) {
        rawHtml = mdToHtml(code);
      }
      
      const template = `<!DOCTYPE html>
<html>
<head>
  <title>Tailored Resume</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
    
    @page {
      size: letter;
      margin: 0.6in 0.5in 0.6in 0.5in;
    }
    
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      color: #1a1a1a;
      line-height: 1.4;
      font-size: 10pt;
      margin: 0;
      padding: 0;
      background-color: #ffffff;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    h1 {
      font-size: 20pt;
      font-weight: 700;
      text-align: center;
      margin: 0 0 5px 0;
      color: #0f172a;
      letter-spacing: -0.02em;
    }

    /* Subtitle / contact info container */
    h1 + p {
      text-align: center;
      font-size: 8.5pt;
      color: #475569;
      margin-bottom: 18px;
      line-height: 1.5;
    }
    h1 + p a {
      color: #475569;
      text-decoration: none;
    }
    h1 + p .pipe {
      margin: 0 6px;
      color: #cbd5e1;
    }

    h2 {
      font-size: 10.5pt;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      border-bottom: 1.5px solid #e2e8f0;
      padding-bottom: 2px;
      margin: 18px 0 6px 0;
      color: #0f172a;
      page-break-after: avoid;
    }

    h3 {
      font-size: 9.5pt;
      font-weight: 600;
      margin: 8px 0 3px 0;
      color: #1e293b;
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      page-break-after: avoid;
    }

    p {
      margin: 0 0 6px 0;
      color: #334155;
    }

    ul {
      margin: 0 0 8px 0;
      padding-left: 20px;
      color: #334155;
    }

    li {
      margin-bottom: 3px;
      padding-left: 2px;
    }

    /* Resume highlights / meta details */
    .date-location {
      font-weight: 400;
      font-size: 8.5pt;
      color: #64748b;
      font-style: italic;
    }

    /* Print utility styles */
    .no-print-btn-container {
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 10000;
      display: flex;
      gap: 10px;
      background: white;
      padding: 10px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.1);
      border: 1px solid #e2e8f0;
    }

    .btn {
      padding: 6px 14px;
      font-size: 12px;
      font-weight: 600;
      font-family: sans-serif;
      border-radius: 6px;
      cursor: pointer;
      border: none;
      transition: all 0.15s ease;
    }

    .btn-primary {
      background: #0f172a;
      color: white;
    }
    .btn-primary:hover {
      background: #1e293b;
    }

    .btn-secondary {
      background: #f1f5f9;
      color: #334155;
      border: 1px solid #e2e8f0;
    }
    .btn-secondary:hover {
      background: #e2e8f0;
    }

    @media print {
      .no-print-btn-container {
        display: none !important;
      }
    }
  </style>
</head>
<body>
  <div class="no-print-btn-container">
    <button class="btn btn-secondary" onclick="window.close()">Close</button>
    <button class="btn btn-primary" onclick="window.print()">Print / Save PDF</button>
  </div>
  
  <div style="max-width: 800px; margin: 0 auto; padding: 20px;">
    ${rawHtml}
  </div>
</body>
</html>`;
      
      printWindow.document.write(template);
      printWindow.document.close();
      
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
      }, 500);
    } catch (err) {
      console.error('Failed to print PDF: ', err);
    }
  };

  return (
    <div className="bg-surface-dark border border-surface-dark-elevated rounded-xl my-4 overflow-hidden shadow-xs w-full font-mono">
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-surface-dark-elevated border-b border-surface-dark/40 text-[10px] text-on-dark-soft select-none">
        <span className="font-bold uppercase tracking-wider">{language || 'code'}</span>
        <div className="flex items-center gap-2">
          {(language === 'html' || language === 'svg' || language === 'xml') && onOpenPreview && (
            <button
              type="button"
              onClick={() => onOpenPreview(code, `Preview (${language.toUpperCase()})`)}
              className="flex items-center gap-1 text-accent-teal hover:text-white transition-colors cursor-pointer px-1.5 py-0.5 rounded hover:bg-surface-dark font-semibold"
            >
              <ExternalLink className="w-3 h-3 text-accent-teal" />
              <span className="text-[9px]">View Preview</span>
            </button>
          )}

          <button
            type="button"
            onClick={copyToClipboard}
            className="flex items-center gap-1 hover:text-white transition-colors cursor-pointer px-1.5 py-0.5 rounded hover:bg-surface-dark font-semibold"
          >
            {isCopied ? (
              <>
                <Check className="w-3 h-3 text-emerald-500" />
                <span className="text-[9px] text-emerald-500">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3 h-3" />
                <span className="text-[9px]">Copy</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={downloadAsFile}
            className="flex items-center gap-1 hover:text-white transition-colors cursor-pointer px-1.5 py-0.5 rounded hover:bg-surface-dark font-semibold"
            title="Download as file"
          >
            <Download className="w-3 h-3" />
            <span className="text-[9px]">Download</span>
          </button>

          {(language === 'markdown' || language === 'md' || language === 'html' || language === 'text' || !language || code.includes('RESUME') || code.includes('Resume') || code.includes('PROFESSIONAL SUMMARY')) && (
            <button
              type="button"
              onClick={downloadAsPdf}
              className="flex items-center gap-1 text-emerald-500 hover:text-white transition-colors cursor-pointer px-1.5 py-0.5 rounded hover:bg-surface-dark font-semibold"
              title="Print or Save as PDF"
            >
              <Printer className="w-3 h-3 text-emerald-500" />
              <span className="text-[9px]">Print PDF</span>
            </button>
          )}
        </div>
      </div>
      {/* Code contents */}
      <pre className="p-4 overflow-x-auto text-[11px] text-on-dark bg-surface-dark leading-relaxed">
        <code className="bg-transparent! p-0! border-0!">{code}</code>
      </pre>
    </div>
  );
}

import ToolCallBlock from './ToolCallBlock';

export default function MessageBubble({ message, onOpenPreview, onEditMessage, onRegenerateMessage }: MessageBubbleProps) {
  const { role, content } = message;
  const [toolCalls, setToolCalls] = React.useState<any[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(content);
  const [isCopied, setIsCopied] = useState(false);
  
  const [feedback, setFeedback] = useState<'up' | 'down' | null>(() => {
    if (typeof window !== 'undefined' && message.id) {
      const saved = localStorage.getItem(`message-feedback-${message.id}`);
      return saved as 'up' | 'down' | null;
    }
    return null;
  });

  React.useEffect(() => {
    setEditContent(content);
  }, [content]);

  React.useEffect(() => {
    if (role === 'assistant' && message.id) {
      fetch(`/api/tool-calls?projectId=${message.project_id}&messageId=${message.id}`)
        .then((res) => res.json())
        .then((data) => {
          if (Array.isArray(data)) {
            setToolCalls(data);
          }
        })
        .catch((err) => console.warn('Failed to fetch tool calls for message:', err));
    }
  }, [role, message.id, message.project_id]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy message:', err);
    }
  };

  const handleFeedback = (type: 'up' | 'down') => {
    const nextFeedback = feedback === type ? null : type;
    setFeedback(nextFeedback);
    if (message.id) {
      if (nextFeedback) {
        localStorage.setItem(`message-feedback-${message.id}`, nextFeedback);
      } else {
        localStorage.removeItem(`message-feedback-${message.id}`);
      }
    }
  };

  if (role === 'user') {
    if (isEditing) {
      return (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="flex flex-col items-end w-full font-dmsans"
        >
          <div className="w-full max-w-[75%] bg-[#FFFFFF] border border-[#E5E0DA] rounded-2xl p-3 shadow-xs flex flex-col gap-2">
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="w-full min-h-[60px] bg-transparent border-0 text-[#191919] text-xs resize-none focus:outline-none leading-relaxed font-dmsans"
            />
            <div className="flex items-center justify-end gap-2 border-t border-[#FBF9F6] pt-2">
              <button
                type="button"
                onClick={() => {
                  setIsEditing(false);
                  setEditContent(content);
                }}
                className="px-2.5 py-1 rounded-lg border border-[#E5E0DA] hover:bg-[#F4F0EB] text-[#5E5B56] text-[10px] font-bold cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (editContent.trim() && onEditMessage && message.id) {
                    onEditMessage(message.id, editContent);
                    setIsEditing(false);
                  }
                }}
                className="px-2.5 py-1 rounded-lg bg-primary hover:bg-primary-active text-white text-[10px] font-bold cursor-pointer transition-colors"
              >
                Save & Resubmit
              </button>
            </div>
          </div>
        </motion.div>
      );
    }

    return (
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="flex flex-col items-end w-full font-dmsans group"
      >
        <div className="flex items-center gap-2 max-w-[75%]">
          {/* User Bubble Hover actions */}
          <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-150 flex items-center gap-1 bg-[#FFFFFF]/90 border border-[#E5E0DA] rounded-full p-0.5 shadow-2xs select-none">
            <button
              type="button"
              onClick={handleCopy}
              className="p-1 hover:bg-[#F4F0EB] text-[#85827D] hover:text-[#191919] rounded-full transition-colors cursor-pointer"
              title="Copy message"
            >
              {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
            {onEditMessage && (
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="p-1 hover:bg-[#F4F0EB] text-[#85827D] hover:text-[#191919] rounded-full transition-colors cursor-pointer"
                title="Edit message"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="bg-white border border-hairline text-ink rounded-2xl rounded-tr-sm px-4 py-2.5 text-xs leading-relaxed shadow-xs select-text">
            {content}
          </div>
        </div>
      </motion.div>
    );
  }

  if (role === 'auto') {
    if (content.includes('[MCP TOOL RESULTS INJECTED]')) {
      return <ToolCallBlock content={content} projectId={message.project_id} agentId={message.agent_id} />;
    }

    if (content.startsWith('[TOOL_CALL]')) {
      return <ToolCallWidget content={content} />;
    }

    return (
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="flex flex-col items-start w-full font-dmsans"
      >
        <div className="bg-[#ECE9FC] border border-[#D5CFF8] text-[#5B39E0] rounded-2xl rounded-tl-sm px-4 py-2.5 text-xs max-w-[85%] font-bold leading-relaxed shadow-[0_1px_3px_rgba(0,0,0,0.02)] select-text">
          {content}
        </div>
      </motion.div>
    );
  }

  if (role === 'system') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="flex flex-col items-center w-full my-4 font-dmsans"
      >
        <div className="bg-[#FEE2E2] border border-[#FCA5A5] text-[#EF4444] rounded-full px-4 py-1 text-[10px] font-bold shadow-2xs select-text">
          {content}
        </div>
      </motion.div>
    );
  }

  // Assistant response
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className="flex flex-col items-start w-full font-dmsans group"
    >
      <div className="w-full text-ink select-text">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            h1: ({ ...props }) => <h1 className="font-lora text-xl font-normal tracking-tight mt-6 mb-2.5 text-ink" {...props} />,
            h2: ({ ...props }) => <h2 className="font-lora text-lg font-normal tracking-tight mt-5 mb-2 text-ink" {...props} />,
            h3: ({ ...props }) => <h3 className="font-lora text-base font-normal tracking-tight mt-4 mb-1.5 text-ink" {...props} />,
            h4: ({ ...props }) => <h4 className="font-lora text-sm font-normal tracking-tight mt-3 mb-1 text-ink" {...props} />,
            h5: ({ ...props }) => <h5 className="font-lora text-xs font-normal tracking-tight mt-2.5 mb-1 text-ink" {...props} />,
            h6: ({ ...props }) => <h6 className="font-lora text-[11px] font-normal tracking-tight mt-2 mb-0.5 text-ink" {...props} />,
            p: ({ ...props }) => <p className="mb-3 last:mb-0 text-ink text-xs leading-[1.75] font-dmsans" {...props} />,
            ul: ({ ...props }) => <ul className="list-disc pl-6 my-2 mb-4 space-y-1.5 text-xs text-ink font-dmsans" {...props} />,
            ol: ({ ...props }) => <ol className="list-decimal pl-6 my-2 mb-4 space-y-1.5 text-xs text-ink font-dmsans" {...props} />,
            li: ({ ...props }) => <li className="text-ink leading-relaxed font-dmsans" {...props} />,
            code: ({ className, children, ...props }) => {
              const match = /language-(\w+)/.exec(className || '');
              const isInline = !match;
              return isInline ? (
                <code className="bg-surface-card border border-hairline text-ink font-mono text-[10px] px-1.5 py-0.5 rounded-md" {...props}>
                  {children}
                </code>
              ) : (
                <CodeBlock 
                  language={match[1]} 
                  code={String(children).replace(/\n$/, '')} 
                  onOpenPreview={onOpenPreview}
                />
              );
            },
            blockquote: ({ ...props }) => (
              <blockquote className="border-l-3 border-primary py-2.5 px-3.5 bg-surface-soft rounded-r-xl rounded-lg italic my-4 text-muted text-xs leading-relaxed font-dmsans" {...props} />
            ),
            hr: ({ ...props }) => <hr className="border-hairline my-6" {...props} />,
            table: ({ ...props }) => (
              <div className="overflow-x-auto my-4 rounded-xl border border-hairline bg-white shadow-2xs">
                <table className="min-w-full divide-y divide-hairline text-xs text-ink" {...props} />
              </div>
            ),
            thead: ({ ...props }) => <thead className="bg-surface-soft/50" {...props} />,
            th: ({ ...props }) => <th className="px-4 py-2.5 text-left font-bold text-ink uppercase tracking-wider text-[10px]" {...props} />,
            td: ({ ...props }) => <td className="px-4 py-3 border-t border-hairline hover:bg-surface-card transition-colors duration-100" {...props} />,
          }}
        >
          {content}
        </ReactMarkdown>
      </div>
      {toolCalls.length > 0 && (
        <div className="w-full mt-3 space-y-2">
          {toolCalls.map((tc) => (
            <ToolCallBlock key={tc.id} toolCall={tc} />
          ))}
        </div>
      )}

      {/* Assistant bubble actions row */}
      {message.id && (
        <div className={`flex items-center gap-2.5 mt-2 border-t border-[#FBF9F6]/20 pt-1.5 self-start select-none transition-opacity duration-150 ${
          feedback ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
        }`}>
          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-1 text-[#85827D] hover:text-[#191919] transition-colors cursor-pointer px-1.5 py-0.5 rounded hover:bg-[#F4F0EB]/50 text-[10px] font-bold"
            title="Copy response"
          >
            {isCopied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-emerald-600">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy</span>
              </>
            )}
          </button>

          {onRegenerateMessage && (
            <button
              type="button"
              onClick={() => onRegenerateMessage(message.id)}
              className="flex items-center gap-1 text-[#85827D] hover:text-[#191919] transition-colors cursor-pointer px-1.5 py-0.5 rounded hover:bg-[#F4F0EB]/50 text-[10px] font-bold"
              title="Regenerate response"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Retry</span>
            </button>
          )}

          <div className="h-3.5 w-px bg-[#E5E0DA]" />

          <button
            type="button"
            onClick={() => handleFeedback('up')}
            className={`p-1 rounded hover:bg-[#F4F0EB]/50 transition-colors cursor-pointer ${
              feedback === 'up' ? 'text-emerald-600' : 'text-[#85827D] hover:text-[#191919]'
            }`}
            title="Thumbs up"
          >
            <ThumbsUp className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => handleFeedback('down')}
            className={`p-1 rounded hover:bg-[#F4F0EB]/50 transition-colors cursor-pointer ${
              feedback === 'down' ? 'text-rose-600' : 'text-[#85827D] hover:text-[#191919]'
            }`}
            title="Thumbs down"
          >
            <ThumbsDown className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </motion.div>
  );
}
