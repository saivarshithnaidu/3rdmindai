export type CodingMode = 'build' | 'edit' | 'review' | 'debug';
export type CodeLanguage = 'typescript' | 'javascript' | 'python' | 'rust' | 'go' | 'html' | 'css' | 'sql' | 'shell' | 'java' | 'php' | string;

export interface CodingSession {
  id: string;
  project_id: string;
  user_id: string;
  mode: CodingMode;
  language: CodeLanguage;
  framework: string | null;
  description: string;
  status: 'running' | 'complete' | 'failed';
  github_repo: string | null;
  github_branch: string | null;
  created_at: string;
}

export interface CodeFile {
  id: string;
  session_id: string;
  file_path: string;
  language: string;
  content: string;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface CodeIssue {
  severity: 'critical' | 'major' | 'minor';
  line: number | null;
  issue: string;
  fix: string;
  code_fix: string;
}

export interface CodeSuggestion {
  type: string;
  description: string;
  example: string;
}

export interface SecurityFlag {
  type: string;
  severity: 'high' | 'medium' | 'low';
  description: string;
  fix: string;
}

export interface CodeReview {
  id: string;
  session_id: string;
  overall_score: number;
  issues: CodeIssue[];
  suggestions: CodeSuggestion[];
  security_flags: SecurityFlag[];
  summary: string;
  created_at: string;
}

export interface CodeTemplate {
  id: string;
  name: string;
  description: string;
  stack: string[];
  files: number;
  icon: string;
}
