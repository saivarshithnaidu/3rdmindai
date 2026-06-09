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
  autonomous_mode?: boolean;
  autonomous_level?: AutonomousLevel;
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
  slug?: string;
  name: string;
  category: string;
  description: string;
  authType: 'api_key' | 'oauth' | 'none';
  serverUrl: string;
  isActive: boolean;
  toolsAvailable?: number;
  docsUrl?: string;
  icon?: string;
  api_key?: string | null;
  access_token?: string | null;
  refresh_token?: string | null;
  token_expiry?: string | null;
  scopes?: string[] | null;
  metadata?: Record<string, any>;
}

export interface ConnectorConfig {
  slug: string;
  name: string;
  category: 'productivity' | 'communication' | 'developer' | 'search' | 'storage' | 'crm' | 'finance' | 'ai' | 'data';
  description: string;
  authType: 'oauth' | 'api_key' | 'none';
  icon: string;
  docsUrl: string;
  scopes?: string[];
  keyLabel?: string;
  keyPlaceholder?: string;
  keyDocsUrl?: string;
  serverUrl: string;
  tools: string[];
  isConnected?: boolean;
  toolsAvailable?: number;
}

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  connectorId?: string;
  connectorSlug?: string;
  connectorName: string;
}

export interface ToolCall {
  id: string;
  project_id: string;
  agent_id: string;
  message_id?: string | null;
  connector_id?: string;
  connector_slug?: string;
  tool_name: string;
  params: Record<string, unknown>;
  result: Record<string, unknown>;
  status: 'pending' | 'running' | 'done' | 'error';
  duration_ms: number;
  created_at: string;
}

export type AgentRole = 'ceo' | 'cmo' | 'cto' | 'cfo' | 'cso' | 'cro';
export type TaskStatus = 'queued' | 'running' | 'done' | 'failed';
export type MemoryType = 'decision' | 'output' | 'fact' | 'preference' | 'learning';

export interface StartupAgent {
  id: string;
  project_id: string;
  role: AgentRole;
  name: string;
  model: string;
  is_active: boolean;
  last_run_at: string | null;
  tasks_completed: number;
  created_at: string;
}

export interface AgentTask {
  id: string;
  agent_id: string;
  project_id: string;
  title: string;
  description: string;
  status: TaskStatus;
  output: string | null;
  tools_used: string[];
  triggered_by: 'user' | 'agent' | 'schedule';
  triggered_by_agent_id: string | null;
  started_at: string | null;
  completed_at: string | null;
  judge_score?: number | null;
  judge_feedback?: string | null;
  judge_passed?: boolean | null;
  revision_round?: number;
  revision_of_task_id?: string | null;
  final_status?: 'done' | 'done_with_warnings' | 'failed_quality';
  created_at: string;
}

export interface AgentMemory {
  id: string;
  agent_id: string;
  project_id: string;
  memory_type: MemoryType;
  content: string;
  source_task_id: string | null;
  created_at: string;
}

export interface AgentMessage {
  id: string;
  from_agent_id: string;
  to_agent_id: string;
  project_id: string;
  subject: string;
  content: string;
  read: boolean;
  reply_task_id: string | null;
  created_at: string;
}

export interface StartupContext {
  companyName: string;
  product: string;
  targetMarket: string;
  stage: 'idea' | 'mvp' | 'early-revenue' | 'growth';
  problem: string;
}

export interface JudgeEvaluation {
  id: string;
  task_id: string;
  agent_id: string;
  project_id: string;
  round: number;
  score_complete: number;
  score_accurate: number;
  score_actionable: number;
  score_role: number;
  score_quality: number;
  total_score: number;
  passed: boolean;
  feedback: string;
  revision_prompt: string | null;
  created_at: string;
}

export interface AutonomousRun {
  id: string;
  project_id: string;
  week_start: string;
  triggered_by: 'schedule' | 'user';
  total_tasks: number;
  completed_tasks: number;
  emails_sent: number;
  posts_created: number;
  leads_found: number;
  status: 'running' | 'done' | 'partial';
  summary: string | null;
  created_at: string;
}

export interface PendingApproval {
  id: string;
  project_id: string;
  agent_id: string;
  task_id: string;
  action_type: 'send_email' | 'post_content' | 'create_file' | 'api_call';
  action_data: Record<string, unknown>;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  decided_at: string | null;
}

export interface OutreachLead {
  id: string;
  project_id: string;
  agent_id: string;
  company_name: string;
  contact_name: string | null;
  contact_email: string | null;
  company_url: string | null;
  company_size: string | null;
  industry: string | null;
  research_notes: string | null;
  email_subject: string | null;
  email_body: string | null;
  email_sent: boolean;
  email_sent_at: string | null;
  reply_received: boolean;
  status: 'found' | 'researched' | 'drafted' | 'sent' | 'replied' | 'converted';
  created_at: string;
}

export interface AgentAnalytics {
  id?: string;
  agent_id: string;
  project_id: string;
  week_start: string;
  tasks_completed: number;
  tasks_failed: number;
  avg_judge_score: number;
  avg_revision_rounds: number;
  emails_sent: number;
  memories_created: number;
  created_at?: string;
}

export type AutonomousLevel = 'supervised' | 'semi-auto' | 'full-auto';

export interface WebhookConfig {
  id: string;
  project_id: string;
  direction: 'inbound' | 'outbound';
  source?: 'stripe' | 'github' | 'custom' | null;
  url?: string | null;
  events?: string[] | null;
  secret: string;
  agent_role?: string | null;
  task_prefix?: string | null;
  is_active: boolean;
  created_at: string;
}

export interface BrowserSession {
  id: string;
  project_id: string;
  agent_id: string | null;
  canvas_id: string | null;
  session_id: string;
  live_view_url: string;
  current_url?: string | null;
  status: 'active' | 'completed' | 'error';
  scraper_type: string;
  query: string;
  rows_extracted: number;
  created_at: string;
}

export interface ScraperConfig {
  id: string;
  name: string;
  description: string;
  icon: string;
  queryPlaceholder: string;
  columns: ColumnSchema[];
  maxResults: number;
}

export type WatchPlatform = 'amazon' | 'flipkart' | 'meesho' | 'custom';
export type WatchStatus = 'watching' | 'triggered' | 'paused' | 'expired';

export interface PriceWatch {
  id: string;
  user_id: string;
  project_id: string | null;
  product_name: string;
  product_url: string;
  platform: WatchPlatform;
  target_price: number;
  current_price: number | null;
  original_price: number | null;
  lowest_price: number | null;
  currency: string;
  check_interval: number;
  alert_email: string | null;
  alert_whatsapp: string | null;
  image_url: string | null;
  status: WatchStatus;
  triggered_at: string | null;
  last_checked_at: string | null;
  created_at: string;
}

export interface PriceHistory {
  id: string;
  watch_id: string;
  price: number;
  in_stock: boolean;
  deal_score: number;
  scraped_at: string;
}

export interface PriceAlertSent {
  id: string;
  watch_id: string;
  channel: 'email' | 'whatsapp';
  message: string;
  sent_at: string;
  delivered: boolean;
}

export interface CompetitorProfile {
  id: string;
  project_id: string;
  user_id: string;
  competitor_url: string;
  competitor_name: string;
  competitor_domain: string;
  google_ads_id: string | null;
  meta_page_id: string | null;
  linkedin_id: string | null;
  last_scraped_at: string | null;
  created_at: string;
}

export interface CompetitorAd {
  id: string;
  competitor_id: string;
  platform: 'google' | 'meta' | 'linkedin' | 'tiktok';
  ad_id: string | null;
  headline: string | null;
  body: string | null;
  cta: string | null;
  image_url: string | null;
  video_url?: string | null;
  landing_url: string | null;
  start_date: string | null;
  is_active: boolean;
  running_days: number | null;
  impressions_min: number | null;
  impressions_max: number | null;
  spend_min?: number | null;
  spend_max?: number | null;
  platforms_used: string[] | null;
  raw_data: Record<string, any>;
  scraped_at: string;
}

export interface AdVariation {
  variation_number: number;
  angle: string;
  headline: string;
  body: string;
  cta: string;
  why_this_works: string;
  inspired_by: string;
}

export interface AdIntelReport {
  id: string;
  project_id: string;
  competitor_id: string;
  report_type: 'full' | 'quick' | 'update';
  total_ads_found: number;
  active_ads: number;
  top_angles: { angle: string; frequency: number; example: string }[];
  top_ctas: { cta: string; count: number }[];
  top_formats: { format: string; count: number }[];
  winning_ads: CompetitorAd[];
  insights: string | null;
  generated_at: string;
}

export interface GeneratedCampaign {
  id: string;
  project_id: string;
  competitor_id: string | null;
  report_id: string | null;
  platform: string;
  campaign_name: string;
  target_audience: string;
  ad_variations: AdVariation[];
  strategy: string | null;
  status: 'draft' | 'approved' | 'running';
  created_at: string;
}

export * from '../lib/stream-events';
