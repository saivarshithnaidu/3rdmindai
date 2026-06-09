'use client';

import React, { useState } from 'react';
import { CodeFile } from '../../types/coding';

interface FileTreeProps {
  files: CodeFile[];
  selectedFilePath: string | null;
  onFileSelect: (filePath: string) => void;
  activeFileWriting?: string | null;
}

interface TreeNode {
  name: string;
  path: string;
  isDir: boolean;
  children: TreeNode[];
  file?: CodeFile;
}

function buildTree(files: CodeFile[]): TreeNode[] {
  const root: TreeNode[] = [];
  
  for (const file of files) {
    const parts = file.file_path.split('/');
    let currentLevel = root;
    let currentPath = '';

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      const isLast = i === parts.length - 1;

      let node = currentLevel.find(n => n.name === part);
      if (!node) {
        node = {
          name: part,
          path: currentPath,
          isDir: !isLast,
          children: [],
          file: isLast ? file : undefined
        };
        currentLevel.push(node);
      }
      
      if (!isLast) {
        currentLevel = node.children;
      }
    }
  }

  const sortTree = (nodes: TreeNode[]) => {
    nodes.sort((a, b) => {
      if (a.isDir && !b.isDir) return -1;
      if (!a.isDir && b.isDir) return 1;
      return a.name.localeCompare(b.name);
    });
    for (const node of nodes) {
      if (node.isDir) {
        sortTree(node.children);
      }
    }
  };
  
  sortTree(root);
  return root;
}

function getFileIcon(filePath: string) {
  const ext = filePath.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'ts':
    case 'tsx':
      return <i className="ti ti-brand-typescript text-blue-500 text-sm" />;
    case 'js':
    case 'jsx':
      return <i className="ti ti-brand-javascript text-yellow-500 text-sm" />;
    case 'py':
      return <i className="ti ti-brand-python text-sky-400 text-sm" />;
    case 'css':
      return <i className="ti ti-brand-css3 text-pink-500 text-sm" />;
    case 'html':
      return <i className="ti ti-brand-html5 text-orange-500 text-sm" />;
    case 'json':
      return <i className="ti ti-code-asterisk text-green-500 text-sm" />;
    case 'md':
      return <i className="ti ti-markdown text-gray-400 text-sm" />;
    case 'sql':
      return <i className="ti ti-database text-blue-400 text-sm" />;
    default:
      return <i className="ti ti-file-code text-[#85827D] text-sm" />;
  }
}

export default function FileTree({
  files,
  selectedFilePath,
  onFileSelect,
  activeFileWriting
}: FileTreeProps) {
  const [expandedDirs, setExpandedDirs] = useState<Record<string, boolean>>({});

  const toggleDir = (path: string) => {
    setExpandedDirs(prev => ({
      ...prev,
      [path]: !prev[path]
    }));
  };

  const tree = buildTree(files);

  const renderNode = (node: TreeNode, depth = 0) => {
    const isExpanded = expandedDirs[node.path] !== false; // Default to expanded
    const isSelected = selectedFilePath === node.path;
    const isWriting = activeFileWriting === node.path;

    if (node.isDir) {
      return (
        <div key={node.path} className="select-none">
          <button
            onClick={() => toggleDir(node.path)}
            className="w-full flex items-center gap-1.5 py-1 px-2 hover:bg-[#E9E3DB] rounded text-left font-dmsans text-xs text-[#191919] font-medium transition-colors cursor-pointer"
            style={{ paddingLeft: `${depth * 8 + 8}px` }}
          >
            <i className={`ti ${isExpanded ? 'ti-chevron-down' : 'ti-chevron-right'} text-[10px] text-[#85827D]`} />
            <i className="ti ti-folder text-amber-500 text-sm" />
            <span className="truncate">{node.name}</span>
          </button>
          {isExpanded && (
            <div className="mt-0.5">
              {node.children.map(child => renderNode(child, depth + 1))}
            </div>
          )}
        </div>
      );
    }

    return (
      <button
        key={node.path}
        onClick={() => onFileSelect(node.path)}
        className={`w-full flex items-center gap-2 py-1 px-2 rounded text-left font-dmsans text-xs transition-colors cursor-pointer ${
          isSelected 
            ? 'bg-[#cc785c]/10 text-[#cc785c] font-semibold border-l-2 border-[#cc785c]' 
            : 'text-[#5E5B56] hover:bg-[#E9E3DB] hover:text-[#191919]'
        }`}
        style={{ paddingLeft: `${depth * 8 + 16}px` }}
      >
        {isWriting ? (
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
          </span>
        ) : (
          getFileIcon(node.path)
        )}
        <span className="truncate flex-1">{node.name}</span>
        {isWriting && (
          <span className="text-[9px] text-green-600 bg-green-50 px-1 rounded animate-pulse">
            writing...
          </span>
        )}
      </button>
    );
  };

  return (
    <div className="space-y-0.5 max-h-[300px] overflow-y-auto pr-1 font-dmsans">
      {tree.length === 0 ? (
        <div className="text-center py-6 text-xs text-[#85827D]">
          No files generated yet.
        </div>
      ) : (
        tree.map(node => renderNode(node))
      )}
    </div>
  );
}
