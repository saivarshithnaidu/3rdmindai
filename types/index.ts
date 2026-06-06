export type AgentStatus = 'pending' | 'running' | 'done' | 'error';
export type AgentType = 'orchestrator' | 'subagent';
export type MessageRole = 'user' | 'assistant' | 'auto' | 'system';

export interface Project {
  id: string;
  name: string;
  goal: string;
  user_id?: string | null;
  master_resume?: string | null;
  master_resume_filename?: string | null;
  created_at?: string;
}

export interface Agent {
  id: string;
  project_id: string;
  parent_agent_id: string | null;
  name: string;
  role: string;
  task?: string | null;
  type: AgentType;
  agent_mode: 'executor' | 'manager';
  depth: number;
  locked: boolean;
  status: AgentStatus;
  model?: string | null;
  children_count: number;
  children_done: number;
  token_budget: number;
  tokens_used: number;
  summary: string | null;
  created_at?: string;
}

export interface AgentNode extends Agent {
  children: AgentNode[];
}

export interface Message {
  id: string;
  agent_id: string;
  project_id: string;
  role: MessageRole;
  content: string;
  created_at?: string;
}

export interface ModelOption {
  id: string;
  name: string;
  provider: string;
}

export interface ColumnSchema {
  key: string;
  label: string;
  type: 'text' | 'number' | 'url' | 'date';
}

export interface Canvas {
  id: string;
  project_id: string;
  agent_id: string;
  name: string;
  columns: ColumnSchema[];
  rows_target: number;
  rows_done: number;
  mode: 'search' | 'enrich';
  status: 'building' | 'done' | 'error';
  created_at: string;
}

export interface CanvasRow {
  id: string;
  canvas_id: string;
  row_index: number;
  data: Record<string, unknown>;
  sources: string[];
  created_at: string;
}

export interface Artifact {
  id: string;
  project_id: string;
  agent_id: string | null;
  type: 'app' | 'document' | 'chart' | 'tool' | 'game' | 'code';
  title: string;
  code: string;
  version: number;
  created_at: string;
}

export interface CouncilSeat {
  name: string;
  role: string;
  model: string;
}

export interface CouncilConfig {
  seats: CouncilSeat[];
  enableVerdict: boolean;
}

export interface Connector {
  id: string;
  project_id?: string | null;
  user_id?: string | null;
  name: string;
  category: string;
  description: string;
  authType: 'api_key' | 'oauth' | 'none';
  serverUrl: string;
  isActive: boolean;
  toolsAvailable?: number;
  docsUrl?: string;
  icon?: string;
}

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  connectorId: string;
  connectorName: string;
}

export interface ToolCall {
  id: string;
  project_id: string;
  agent_id: string;
  message_id?: string | null;
  connector_id: string;
  tool_name: string;
  params: Record<string, unknown>;
  result: Record<string, unknown>;
  status: 'pending' | 'running' | 'done' | 'error';
  duration_ms: number;
  created_at: string;
}

