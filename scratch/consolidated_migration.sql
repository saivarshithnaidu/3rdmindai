-- =========================================================================
-- 3RDMIND CONSOLIDATED SUPABASE DATABASE MIGRATION SCRIPT
-- =========================================================================
-- This script contains all schemas, indexes, policies, functions, and 
-- realtime publications for features built after the competitive ad intelligence feature.
-- Run this in your Supabase SQL Editor.
-- =========================================================================

-- -------------------------------------------------------------------------
-- 0. EXTENSIONS & PRIVATE SCHEMA SETUP
-- -------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE SCHEMA IF NOT EXISTS private;

CREATE TABLE IF NOT EXISTS private.settings (
  key text PRIMARY KEY,
  value text NOT NULL
);

-- IMPORTANT: Replace 'your_cron_secret_here' with your actual CRON_SECRET if needed.
INSERT INTO private.settings (key, value)
VALUES ('cron_secret', 'your_cron_secret_here')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;


-- -------------------------------------------------------------------------
-- 1. COMPETITIVE AD INTELLIGENCE (SAFE CREATE IF NOT EXISTS)
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS competitor_profiles (
  id              uuid PRIMARY KEY default gen_random_uuid(),
  project_id      uuid REFERENCES projects(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL,
  competitor_url  text NOT NULL,
  competitor_name text NOT NULL,
  competitor_domain text NOT NULL,
  google_ads_id   text,
  meta_page_id    text,
  linkedin_id     text,
  last_scraped_at timestamptz,
  created_at      timestamptz default now()
);

CREATE TABLE IF NOT EXISTS competitor_ads (
  id              uuid PRIMARY KEY default gen_random_uuid(),
  competitor_id   uuid REFERENCES competitor_profiles(id) ON DELETE CASCADE,
  platform        text check (platform in ('google','meta','linkedin','tiktok')),
  ad_id           text,
  headline        text,
  body            text,
  cta             text,
  image_url       text,
  video_url       text,
  landing_url     text,
  start_date      date,
  is_active       boolean default true,
  running_days    integer,
  impressions_min integer,
  impressions_max integer,
  spend_min       integer,
  spend_max       integer,
  platforms_used  text[],
  raw_data        jsonb default '{}',
  scraped_at      timestamptz default now()
);

CREATE TABLE IF NOT EXISTS ad_intelligence_reports (
  id              uuid PRIMARY KEY default gen_random_uuid(),
  project_id      uuid REFERENCES projects(id) ON DELETE CASCADE,
  competitor_id   uuid REFERENCES competitor_profiles(id) ON DELETE CASCADE,
  report_type     text check (report_type in ('full','quick','update')),
  total_ads_found integer default 0,
  active_ads      integer default 0,
  top_angles      jsonb default '[]',
  top_ctas        jsonb default '[]',
  top_formats     jsonb default '[]',
  winning_ads     jsonb default '[]',
  insights        text,
  generated_at    timestamptz default now()
);

CREATE TABLE IF NOT EXISTS generated_campaigns (
  id              uuid PRIMARY KEY default gen_random_uuid(),
  project_id      uuid REFERENCES projects(id) ON DELETE CASCADE,
  competitor_id   uuid REFERENCES competitor_profiles(id) ON DELETE SET NULL,
  report_id       uuid REFERENCES ad_intelligence_reports(id) ON DELETE SET NULL,
  platform        text NOT NULL,
  campaign_name   text NOT NULL,
  target_audience text NOT NULL,
  ad_variations   jsonb default '[]',
  strategy        text,
  status          text default 'draft' check (status in ('draft','approved','running')),
  created_at      timestamptz default now()
);


-- -------------------------------------------------------------------------
-- 2. AI CODING AGENT TABLES & VECTOR SEARCH
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS coding_sessions (
  id              uuid PRIMARY KEY default gen_random_uuid(),
  project_id      uuid REFERENCES projects(id) ON DELETE CASCADE,
  user_id         uuid,
  mode            text check (mode in ('build','edit','review','debug')) NOT NULL,
  language        text NOT NULL,
  framework       text,
  description     text NOT NULL,
  status          text default 'running' check (status in ('running','complete','failed')),
  github_repo     text,
  github_branch   text,
  created_at      timestamptz default now()
);

-- Upgrade execution metrics on coding_sessions
ALTER TABLE coding_sessions
  ADD COLUMN IF NOT EXISTS all_tests_passing boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS execution_output text,
  ADD COLUMN IF NOT EXISTS fix_rounds integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sandbox_id text;

CREATE TABLE IF NOT EXISTS code_files (
  id              uuid PRIMARY KEY default gen_random_uuid(),
  session_id      uuid REFERENCES coding_sessions(id) ON DELETE CASCADE,
  file_path       text NOT NULL,
  language        text NOT NULL,
  content         text NOT NULL,
  version         integer default 1,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

CREATE TABLE IF NOT EXISTS code_reviews (
  id              uuid PRIMARY KEY default gen_random_uuid(),
  session_id      uuid REFERENCES coding_sessions(id) ON DELETE CASCADE,
  overall_score   integer check (overall_score >= 0 and overall_score <= 100),
  issues          jsonb default '[]',
  suggestions     jsonb default '[]',
  security_flags  jsonb default '[]',
  summary         text,
  created_at      timestamptz default now()
);

CREATE TABLE IF NOT EXISTS codebase_files (
  id              uuid PRIMARY KEY default gen_random_uuid(),
  project_id      uuid REFERENCES projects(id) ON DELETE CASCADE,
  session_id      uuid REFERENCES coding_sessions(id) ON DELETE SET NULL,
  file_path       text NOT NULL,
  language        text NOT NULL,
  content         text NOT NULL,
  content_hash    text NOT NULL,
  embedding       vector(1536) NULL,
  token_count     integer NOT NULL,
  last_indexed    timestamptz DEFAULT now(),
  created_at      timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS codebase_symbols (
  id              uuid PRIMARY KEY default gen_random_uuid(),
  file_id         uuid REFERENCES codebase_files(id) ON DELETE CASCADE,
  symbol_type     text CHECK (symbol_type IN ('function','class','interface','component','route','schema','type','constant')) NOT NULL,
  name            text NOT NULL,
  signature       text NOT NULL,
  description     text NULL,
  line_start      integer NOT NULL,
  line_end        integer NOT NULL,
  embedding       vector(1536) NULL,
  created_at      timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS deployment_monitors (
  id              uuid PRIMARY KEY default gen_random_uuid(),
  session_id      uuid REFERENCES coding_sessions(id) ON DELETE CASCADE,
  project_id      uuid REFERENCES projects(id) ON DELETE CASCADE,
  deployed_url    text NOT NULL,
  platform        text NOT NULL,
  check_interval  integer DEFAULT 15,
  is_active       boolean DEFAULT true,
  last_checked    timestamptz NULL,
  uptime_percent  float DEFAULT 100,
  avg_response_ms integer NULL,
  error_count     integer DEFAULT 0,
  created_at      timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS deployment_incidents (
  id              uuid PRIMARY KEY default gen_random_uuid(),
  monitor_id      uuid REFERENCES deployment_monitors(id) ON DELETE CASCADE,
  incident_type   text CHECK (incident_type IN ('downtime','slow_response','error_spike','build_failed')) NOT NULL,
  error_details   text NOT NULL,
  auto_fix_attempted boolean DEFAULT false,
  auto_fix_result text NULL,
  resolved        boolean DEFAULT false,
  started_at      timestamptz DEFAULT now(),
  resolved_at     timestamptz NULL
);

CREATE TABLE IF NOT EXISTS code_teams (
  id              uuid PRIMARY KEY default gen_random_uuid(),
  project_id      uuid REFERENCES projects(id) ON DELETE CASCADE,
  session_id      uuid REFERENCES coding_sessions(id) ON DELETE CASCADE,
  description     text NOT NULL,
  status          text DEFAULT 'planning' NOT NULL,
  created_at      timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS code_team_agents (
  id              uuid PRIMARY KEY default gen_random_uuid(),
  team_id         uuid REFERENCES code_teams(id) ON DELETE CASCADE,
  role            text CHECK (role IN ('architect','frontend','backend','database','testing','devops')) NOT NULL,
  model           text NOT NULL,
  status          text DEFAULT 'waiting' CHECK (status IN ('waiting','running','done','failed')) NOT NULL,
  assigned_files  text[] DEFAULT '{}',
  completed_files text[] DEFAULT '{}',
  created_at      timestamptz DEFAULT now()
);

-- Codebase match functions
CREATE OR REPLACE FUNCTION match_codebase_files(
  query_embedding vector(1536),
  match_project_id uuid,
  match_threshold float DEFAULT 0.3,
  match_count int DEFAULT 10
)
RETURNS TABLE (
  id uuid,
  file_path text,
  language text,
  content text,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    codebase_files.id,
    codebase_files.file_path,
    codebase_files.language,
    codebase_files.content,
    (1 - (codebase_files.embedding <=> query_embedding))::float AS similarity
  FROM codebase_files
  WHERE
    codebase_files.project_id = match_project_id
    AND codebase_files.embedding IS NOT NULL
    AND (1 - (codebase_files.embedding <=> query_embedding)) > match_threshold
  ORDER BY similarity DESC
  LIMIT match_count;
END;
$$;

CREATE OR REPLACE FUNCTION match_codebase_symbols(
  query_embedding vector(1536),
  match_project_id uuid,
  match_threshold float DEFAULT 0.3,
  match_count int DEFAULT 10
)
RETURNS TABLE (
  id uuid,
  file_path text,
  symbol_type text,
  name text,
  signature text,
  description text,
  line_start integer,
  line_end integer,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    codebase_symbols.id,
    codebase_files.file_path,
    codebase_symbols.symbol_type,
    codebase_symbols.name,
    codebase_symbols.signature,
    codebase_symbols.description,
    codebase_symbols.line_start,
    codebase_symbols.line_end,
    (1 - (codebase_symbols.embedding <=> query_embedding))::float AS similarity
  FROM codebase_symbols
  JOIN codebase_files ON codebase_symbols.file_id = codebase_files.id
  WHERE
    codebase_files.project_id = match_project_id
    AND codebase_symbols.embedding IS NOT NULL
    AND (1 - (codebase_symbols.embedding <=> query_embedding)) > match_threshold
  ORDER BY similarity DESC
  LIMIT match_count;
END;
$$;


-- -------------------------------------------------------------------------
-- 3. LEARNING / SELF-IMPROVING LOOP TABLES
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS agent_performance_logs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id          UUID REFERENCES startup_agents(id) ON DELETE CASCADE NOT NULL,
  project_id        UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  task_id           UUID REFERENCES agent_tasks(id) ON DELETE CASCADE,
  judge_score       INTEGER,
  user_rating       INTEGER CHECK (user_rating BETWEEN 1 AND 5),
  user_edited       BOOLEAN DEFAULT false NOT NULL,
  user_edit_delta   TEXT,
  outcome_type      TEXT,
  outcome_value     DOUBLE PRECISION,
  task_category     TEXT NOT NULL,
  task_keywords     TEXT[] NOT NULL,
  approach_used     TEXT NOT NULL,
  what_worked       TEXT,
  what_failed       TEXT,
  created_at        TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS agent_learnings (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id          UUID REFERENCES startup_agents(id) ON DELETE CASCADE NOT NULL,
  project_id        UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  learning_type     TEXT CHECK (learning_type IN ('approach','tone','format','timing','tool_usage','user_preference','outcome_pattern')) NOT NULL,
  category          TEXT NOT NULL,
  insight           TEXT NOT NULL,
  confidence        DOUBLE PRECISION DEFAULT 0.5 CHECK (confidence BETWEEN 0 AND 1) NOT NULL,
  evidence_count    INTEGER DEFAULT 1 NOT NULL,
  last_reinforced   TIMESTAMPTZ DEFAULT now() NOT NULL,
  is_active         BOOLEAN DEFAULT true NOT NULL,
  created_at        TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS agent_strategy_versions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id          UUID REFERENCES startup_agents(id) ON DELETE CASCADE NOT NULL,
  project_id        UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  version           INTEGER DEFAULT 1 NOT NULL,
  strategy_additions TEXT NOT NULL,
  strategy_removals  TEXT,
  triggered_by      TEXT CHECK (triggered_by IN ('performance','user','outcome','scheduled')) NOT NULL,
  avg_score_before  DOUBLE PRECISION,
  avg_score_after   DOUBLE PRECISION,
  created_at        TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS outcome_events (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id        UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  agent_id          UUID REFERENCES startup_agents(id) ON DELETE CASCADE NOT NULL,
  task_id           UUID REFERENCES agent_tasks(id) ON DELETE CASCADE,
  event_type        TEXT CHECK (event_type IN ('email_replied','deal_closed','content_engagement','lead_converted','code_deployed','report_used','user_approved','user_rejected')) NOT NULL,
  event_value       DOUBLE PRECISION,
  metadata          JSONB DEFAULT '{}'::jsonb NOT NULL,
  recorded_at       TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS user_feedback (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id          UUID REFERENCES startup_agents(id) ON DELETE CASCADE NOT NULL,
  task_id           UUID REFERENCES agent_tasks(id) ON DELETE CASCADE NOT NULL,
  project_id        UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  rating            INTEGER CHECK (rating BETWEEN 1 AND 5),
  feedback_text     TEXT,
  output_edited     BOOLEAN DEFAULT false NOT NULL,
  original_output   TEXT,
  edited_output     TEXT,
  created_at        TIMESTAMPTZ DEFAULT now() NOT NULL
);


-- -------------------------------------------------------------------------
-- 4. VOICE BRIEFINGS TABLES
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS voice_briefings (
  id              uuid PRIMARY KEY default gen_random_uuid(),
  project_id      uuid REFERENCES projects(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL,
  briefing_date   date NOT NULL,
  script          text NOT NULL,
  audio_url       text,
  duration_secs   integer,
  whatsapp_sent   boolean DEFAULT false,
  email_sent      boolean DEFAULT false,
  status          text DEFAULT 'generating' CHECK (status IN ('generating', 'ready', 'sent', 'failed')),
  created_at      timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS briefing_configs (
  id              uuid PRIMARY KEY default gen_random_uuid(),
  project_id      uuid REFERENCES projects(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL,
  delivery_time   time DEFAULT '08:00',
  timezone        text DEFAULT 'Asia/Kolkata',
  whatsapp_number text,
  email           text,
  voice_id        text DEFAULT 'rachel',
  sections        jsonb DEFAULT '[]',
  is_active       boolean DEFAULT true,
  created_at      timestamptz DEFAULT now()
);


-- -------------------------------------------------------------------------
-- 5. BOARD RESOLUTIONS TABLE
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS board_resolutions (
  id            uuid PRIMARY KEY default gen_random_uuid(),
  project_id    uuid REFERENCES projects(id) ON DELETE CASCADE,
  title         text NOT NULL,
  resolution    text NOT NULL,
  proposed_by   text NOT NULL,
  approved_by   jsonb default '[]',
  status        text default 'proposed' check (status in ('proposed','passed','rejected')),
  created_at    timestamptz default now()
);


-- -------------------------------------------------------------------------
-- 6. DUE DILIGENCE ENGINE TABLES
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS dd_reports (
  id              uuid PRIMARY KEY default gen_random_uuid(),
  project_id      uuid REFERENCES projects(id) ON DELETE CASCADE,
  user_id         uuid,
  target_name     text NOT NULL,
  target_url      text,
  target_domain   text,
  status          text default 'running' check (status in ('running','complete','failed')),
  report_data     jsonb default '{}',
  pdf_url         text,
  created_at      timestamptz default now()
);

CREATE TABLE IF NOT EXISTS dd_sections (
  id              uuid PRIMARY KEY default gen_random_uuid(),
  report_id       uuid REFERENCES dd_reports(id) ON DELETE CASCADE,
  section_type    text check (section_type in (
                  'market_size','competitors',
                  'founder_background','product',
                  'financials','red_flags',
                  'investment_thesis','summary')),
  title           text NOT NULL,
  content         text NOT NULL,
  data            jsonb default '{}',
  sources         jsonb default '[]',
  score           integer check (score >= 0 and score <= 100),
  status          text default 'pending' check (status in ('pending','complete','failed')),
  created_at      timestamptz default now()
);


-- -------------------------------------------------------------------------
-- 7. GRANT & FUNDING FINDER TABLES
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS funding_opportunities (
  id              uuid PRIMARY KEY default gen_random_uuid(),
  name            text NOT NULL,
  provider        text NOT NULL,
  type            text check (type in ('grant', 'accelerator', 'loan', 'equity', 'competition')),
  amount_min      bigint,
  amount_max      bigint,
  currency        text default 'INR',
  eligibility     text NOT NULL,
  deadline        date,
  application_url text NOT NULL,
  description     text NOT NULL,
  stage_fit       text[] default '{}',
  sector_fit      text[] default '{}',
  country         text default 'IN',
  source_url      text NOT NULL,
  is_active       boolean default true,
  last_verified   timestamptz default now(),
  created_at      timestamptz default now()
);

CREATE TABLE IF NOT EXISTS funding_matches (
  id              uuid PRIMARY KEY default gen_random_uuid(),
  project_id      uuid REFERENCES projects(id) ON DELETE CASCADE,
  opportunity_id  uuid REFERENCES funding_opportunities(id) ON DELETE CASCADE,
  match_score     integer check (match_score >= 0 and match_score <= 100),
  match_reasons   jsonb default '[]',
  status          text default 'new' check (status in ('new', 'interested', 'applying', 'submitted', 'won', 'lost')),
  application_draft text,
  alert_sent      boolean default false,
  created_at      timestamptz default now()
);


-- -------------------------------------------------------------------------
-- 8. AI HIRING AGENT TABLES
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS job_postings (
  id              uuid PRIMARY KEY default gen_random_uuid(),
  project_id      uuid REFERENCES projects(id) ON DELETE CASCADE,
  title           text NOT NULL,
  department      text NOT NULL,
  location        text NOT NULL,
  work_type       text default 'remote' check (work_type in ('remote','hybrid','onsite')),
  salary_min      integer,
  salary_max      integer,
  currency        text default 'INR',
  requirements    text NOT NULL,
  nice_to_have    text,
  jd_content      text,
  status          text default 'draft' check (status in ('draft','active','closed')),
  created_at      timestamptz default now()
);

CREATE TABLE IF NOT EXISTS candidates (
  id              uuid PRIMARY KEY default gen_random_uuid(),
  job_id          uuid REFERENCES job_postings(id) ON DELETE CASCADE,
  name            text NOT NULL,
  email           text,
  linkedin_url    text,
  resume_url      text,
  resume_text     text,
  source          text default 'linkedin' check (source in ('linkedin','naukri','manual','referral')),
  match_score     integer check (match_score >= 0 and match_score <= 100),
  score_breakdown jsonb default '{}',
  status          text default 'new' check (status in ('new','screening','interview','assessment','offer','rejected','hired')),
  notes           text,
  created_at      timestamptz default now()
);

CREATE TABLE IF NOT EXISTS candidate_emails (
  id              uuid PRIMARY KEY default gen_random_uuid(),
  candidate_id    uuid REFERENCES candidates(id) ON DELETE CASCADE,
  email_type      text check (email_type in ('invite','rejection','followup','offer')),
  subject         text NOT NULL,
  body            text NOT NULL,
  sent_at         timestamptz,
  opened          boolean default false,
  created_at      timestamptz default now()
);

CREATE TABLE IF NOT EXISTS interviews (
  id              uuid PRIMARY KEY default gen_random_uuid(),
  candidate_id    uuid REFERENCES candidates(id) ON DELETE CASCADE,
  job_id          uuid REFERENCES job_postings(id) ON DELETE CASCADE,
  scheduled_at    timestamptz NOT NULL,
  duration_mins   integer default 60,
  interview_type  text default 'technical' check (interview_type in ('screening','technical','cultural','final')),
  questions       jsonb default '[]',
  assessment      text,
  outcome         text,
  calendar_event_id text,
  created_at      timestamptz default now()
);


-- -------------------------------------------------------------------------
-- 9. REPUTATION MONITOR TABLES
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS reputation_monitors (
  id              uuid PRIMARY KEY default gen_random_uuid(),
  project_id      uuid REFERENCES projects(id) ON DELETE CASCADE,
  brand_name      text NOT NULL,
  keywords        text[] default '{}',
  platforms       text[] default '{}',
  check_interval  integer default 24,
  auto_respond    boolean default false,
  last_checked_at timestamptz,
  created_at      timestamptz default now()
);

CREATE TABLE IF NOT EXISTS brand_mentions (
  id              uuid PRIMARY KEY default gen_random_uuid(),
  monitor_id      uuid REFERENCES reputation_monitors(id) ON DELETE CASCADE,
  platform        text NOT NULL,
  source_url      text NOT NULL,
  author          text,
  content         text NOT NULL,
  sentiment       text check (sentiment in ('positive','neutral','negative')),
  sentiment_score float check (sentiment_score >= -1.0 and sentiment_score <= 1.0),
  urgency         text check (urgency in ('critical','high','medium','low')),
  response_draft  text,
  response_sent   boolean default false,
  response_url    text,
  found_at        timestamptz default now()
);

CREATE TABLE IF NOT EXISTS reputation_reports (
  id              uuid PRIMARY KEY default gen_random_uuid(),
  monitor_id      uuid REFERENCES reputation_monitors(id) ON DELETE CASCADE,
  week_start      date NOT NULL,
  total_mentions  integer default 0,
  positive_count  integer default 0,
  neutral_count   integer default 0,
  negative_count  integer default 0,
  avg_sentiment   float default 0.0,
  top_topics      jsonb default '{}',
  summary         text,
  created_at      timestamptz default now()
);


-- -------------------------------------------------------------------------
-- 10. AI PROCUREMENT AGENT TABLES
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS procurement_items (
  id              uuid PRIMARY KEY default gen_random_uuid(),
  project_id      uuid REFERENCES projects(id) ON DELETE CASCADE,
  name            text NOT NULL,
  category        text NOT NULL,
  current_provider text,
  current_price   decimal,
  billing_cycle   text check (billing_cycle in ('monthly','annual','one-time')) default 'monthly',
  currency        text default 'INR',
  renewal_date    date,
  users_count     integer,
  satisfaction    integer check (satisfaction >= 1 and satisfaction <= 5),
  status          text default 'active' check (status in ('active','evaluating','cancelled','renewal_due')),
  notes           text,
  created_at      timestamptz default now()
);

CREATE TABLE IF NOT EXISTS procurement_alternatives (
  id              uuid PRIMARY KEY default gen_random_uuid(),
  item_id         uuid REFERENCES procurement_items(id) ON DELETE CASCADE,
  provider_name   text NOT NULL,
  price           decimal NOT NULL,
  billing_cycle   text NOT NULL,
  features_match  integer check (features_match >= 0 and features_match <= 100),
  savings_amount  decimal,
  recommendation  text,
  source_url      text,
  created_at      timestamptz default now()
);

CREATE TABLE IF NOT EXISTS procurement_requests (
  id              uuid PRIMARY KEY default gen_random_uuid(),
  project_id      uuid REFERENCES projects(id) ON DELETE CASCADE,
  requirement     text NOT NULL,
  budget          decimal,
  timeline        text,
  status          text default 'researching' check (status in ('researching','complete','failed')),
  top_picks       jsonb default '[]',
  recommendation  text,
  created_at      timestamptz default now()
);


-- -------------------------------------------------------------------------
-- 11. WEBSITE HEALTH CHECKER TABLES
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS health_scans (
  id              uuid PRIMARY KEY default gen_random_uuid(),
  project_id      uuid REFERENCES projects(id) ON DELETE CASCADE,
  user_id         uuid,
  target_url      text NOT NULL,
  status          text default 'running' check (status in ('running', 'complete', 'failed')),
  score           integer check (score >= 0 and score <= 100),
  checks_passed   integer default 0,
  checks_failed   integer default 0,
  created_at      timestamptz default now()
);

CREATE TABLE IF NOT EXISTS health_findings (
  id              uuid PRIMARY KEY default gen_random_uuid(),
  scan_id         uuid REFERENCES health_scans(id) ON DELETE CASCADE,
  category        text NOT NULL check (category in ('performance', 'seo', 'accessibility', 'configuration', 'security')),
  priority        text NOT NULL check (priority in ('high', 'medium', 'low', 'info')),
  title           text NOT NULL,
  description     text NOT NULL,
  recommendation  text NOT NULL,
  docs_url        text,
  created_at      timestamptz default now()
);


-- -------------------------------------------------------------------------
-- 12. CONTRACT INTELLIGENCE TABLES
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS contracts (
  id              uuid PRIMARY KEY default gen_random_uuid(),
  project_id      uuid REFERENCES projects(id) ON DELETE CASCADE,
  user_id         uuid,
  name            text NOT NULL,
  contract_type   text check (contract_type in ('nda', 'client', 'employment', 'founder', 'vendor', 'other')),
  original_text   text NOT NULL,
  file_url        text,
  status          text default 'analyzing' check (status in ('analyzing', 'complete', 'failed')),
  created_at      timestamptz default now()
);

CREATE TABLE IF NOT EXISTS contract_analysis (
  id              uuid PRIMARY KEY default gen_random_uuid(),
  contract_id     uuid REFERENCES contracts(id) ON DELETE CASCADE,
  risk_level      text check (risk_level in ('high', 'medium', 'low')),
  risky_clauses   jsonb default '[]',
  missing_clauses jsonb default '[]',
  negotiation_pts jsonb default '[]',
  plain_summary   text NOT NULL,
  counter_proposal text,
  overall_score   integer check (overall_score >= 0 and overall_score <= 100),
  created_at      timestamptz default now()
);

CREATE TABLE IF NOT EXISTS contract_templates (
  id              uuid PRIMARY KEY default gen_random_uuid(),
  project_id      uuid REFERENCES projects(id) ON DELETE CASCADE,
  template_type   text NOT NULL,
  content         text NOT NULL,
  variables       jsonb default '[]',
  created_at      timestamptz default now()
);


-- -------------------------------------------------------------------------
-- 13. WEBHOOK CONFIGURATIONS TABLE
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS webhook_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  source TEXT CHECK (source IN ('stripe', 'github', 'custom')),
  url TEXT,
  events TEXT[],
  secret TEXT NOT NULL,
  agent_role TEXT,
  task_prefix TEXT,
  is_active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);


-- -------------------------------------------------------------------------
-- 14. PRICE WATCH AGENT TABLES
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS price_watches (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL,
  project_id      UUID REFERENCES projects(id) ON DELETE CASCADE,
  product_name    TEXT NOT NULL,
  product_url     TEXT NOT NULL,
  platform        TEXT CHECK (platform IN ('amazon','flipkart','meesho','custom')) NOT NULL,
  target_price    NUMERIC(10,2) NOT NULL,
  current_price   NUMERIC(10,2),
  original_price  NUMERIC(10,2),
  lowest_price    NUMERIC(10,2),
  currency        TEXT DEFAULT 'INR' NOT NULL,
  check_interval  INTEGER DEFAULT 6 NOT NULL,
  alert_email     TEXT,
  alert_whatsapp  TEXT,
  image_url       TEXT,
  status          TEXT DEFAULT 'watching' CHECK (status IN ('watching','triggered','paused','expired')) NOT NULL,
  triggered_at    TIMESTAMPTZ,
  last_checked_at TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS price_history (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  watch_id        UUID REFERENCES price_watches(id) ON DELETE CASCADE NOT NULL,
  price           NUMERIC(10,2) NOT NULL,
  in_stock        BOOLEAN DEFAULT true NOT NULL,
  deal_score      INTEGER DEFAULT 0 NOT NULL,
  scraped_at      TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS price_alerts_sent (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  watch_id        UUID REFERENCES price_watches(id) ON DELETE CASCADE NOT NULL,
  channel         TEXT CHECK (channel IN ('email','whatsapp')) NOT NULL,
  message         TEXT NOT NULL,
  sent_at         TIMESTAMPTZ DEFAULT now() NOT NULL,
  delivered       BOOLEAN DEFAULT false NOT NULL
);


-- -------------------------------------------------------------------------
-- 15. UNIFIED LIVE STREAMING TABLES & TRIGGER
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS stream_events (
  id          uuid PRIMARY KEY default gen_random_uuid(),
  project_id  uuid REFERENCES projects(id) ON DELETE CASCADE,
  event_type  text NOT NULL,
  title       text NOT NULL,
  detail      text,
  agent_id    uuid,
  agent_name  text,
  data        jsonb default '{}',
  status      text default 'running' check (status in ('running','done','error')),
  created_at  timestamptz default now()
);

CREATE OR REPLACE FUNCTION cleanup_stream_events()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM stream_events
  WHERE project_id = NEW.project_id
  AND id NOT IN (
    SELECT id FROM stream_events
    WHERE project_id = NEW.project_id
    ORDER BY created_at DESC
    LIMIT 500
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS cleanup_stream_events_trigger ON stream_events;
CREATE TRIGGER cleanup_stream_events_trigger
AFTER INSERT ON stream_events
FOR EACH ROW
EXECUTE FUNCTION cleanup_stream_events();


-- -------------------------------------------------------------------------
-- 16. LIVE DATA CANVAS TABLES & TRIGGER
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS canvases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  columns JSONB NOT NULL,
  rows_target INTEGER DEFAULT 20 NOT NULL,
  rows_done INTEGER DEFAULT 0 NOT NULL,
  mode TEXT CHECK (mode IN ('search','enrich')) NOT NULL,
  status TEXT DEFAULT 'building' CHECK (status IN ('building','done','error')) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS canvas_rows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  canvas_id UUID REFERENCES canvases(id) ON DELETE CASCADE NOT NULL,
  row_index INTEGER NOT NULL,
  data JSONB NOT NULL,
  sources JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS artifacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
  type TEXT CHECK (type IN ('app','document','chart','tool','game','code')) NOT NULL,
  title TEXT NOT NULL,
  code TEXT NOT NULL,
  version INTEGER DEFAULT 1 NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE OR REPLACE FUNCTION increment_canvas_rows_done(canvas_id_param UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE canvases
  SET rows_done = rows_done + 1
  WHERE id = canvas_id_param;
END;
$$ LANGUAGE plpgsql;


-- -------------------------------------------------------------------------
-- 17. STARTUP AGENT UPGRADES & EVALUATION TABLES (PHASE 3 & 4)
-- -------------------------------------------------------------------------
-- Alter existing agent_memory to support vector embeddings
ALTER TABLE agent_memory ADD COLUMN IF NOT EXISTS embedding vector(1536) NULL;

-- Match agent memories vector search function
CREATE OR REPLACE FUNCTION match_agent_memories(
  query_embedding vector(1536),
  match_agent_id uuid,
  match_project_id uuid,
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 10
)
RETURNS TABLE (
  id uuid,
  content text,
  memory_type text,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    agent_memory.id,
    agent_memory.content,
    agent_memory.memory_type,
    (1 - (agent_memory.embedding <=> query_embedding))::float AS similarity
  FROM agent_memory
  WHERE
    agent_memory.agent_id = match_agent_id
    AND agent_memory.project_id = match_project_id
    AND agent_memory.embedding IS NOT NULL
    AND (1 - (agent_memory.embedding <=> query_embedding)) > match_threshold
  ORDER BY similarity DESC
  LIMIT match_count;
END;
$$;

-- Alter existing agent_tasks to support judge evaluations and revisions
ALTER TABLE agent_tasks ADD COLUMN IF NOT EXISTS judge_score integer NULL CHECK (judge_score >= 0 AND judge_score <= 50);
ALTER TABLE agent_tasks ADD COLUMN IF NOT EXISTS judge_feedback text NULL;
ALTER TABLE agent_tasks ADD COLUMN IF NOT EXISTS judge_passed boolean NULL;
ALTER TABLE agent_tasks ADD COLUMN IF NOT EXISTS revision_round integer DEFAULT 0 NOT NULL;
ALTER TABLE agent_tasks ADD COLUMN IF NOT EXISTS revision_of_task_id uuid REFERENCES agent_tasks(id) ON DELETE SET NULL;
ALTER TABLE agent_tasks ADD COLUMN IF NOT EXISTS final_status text DEFAULT 'done' NOT NULL CHECK (final_status IN ('done', 'done_with_warnings', 'failed_quality'));

-- Alter existing projects to support autonomous mode
ALTER TABLE projects ADD COLUMN IF NOT EXISTS autonomous_mode boolean DEFAULT false NOT NULL;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS autonomous_level text DEFAULT 'supervised' NOT NULL CHECK (autonomous_level IN ('supervised', 'semi-auto', 'full-auto'));
ALTER TABLE projects ADD COLUMN IF NOT EXISTS master_resume TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS master_resume_filename TEXT;

CREATE TABLE IF NOT EXISTS judge_evaluations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid REFERENCES agent_tasks(id) ON DELETE CASCADE NOT NULL,
  agent_id uuid REFERENCES startup_agents(id) ON DELETE CASCADE NOT NULL,
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  round integer DEFAULT 1 NOT NULL,
  score_complete integer NOT NULL CHECK (score_complete >= 0 AND score_complete <= 10),
  score_accurate integer NOT NULL CHECK (score_accurate >= 0 AND score_accurate <= 10),
  score_actionable integer NOT NULL CHECK (score_actionable >= 0 AND score_actionable <= 10),
  score_role integer NOT NULL CHECK (score_role >= 0 AND score_role <= 10),
  score_quality integer NOT NULL CHECK (score_quality >= 0 AND score_quality <= 10),
  total_score integer NOT NULL CHECK (total_score >= 0 AND total_score <= 50),
  passed boolean NOT NULL,
  feedback text NOT NULL,
  revision_prompt text,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS autonomous_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  week_start date NOT NULL,
  triggered_by text NOT NULL CHECK (triggered_by IN ('schedule', 'user')),
  total_tasks integer DEFAULT 0 NOT NULL,
  completed_tasks integer DEFAULT 0 NOT NULL,
  emails_sent integer DEFAULT 0 NOT NULL,
  posts_created integer DEFAULT 0 NOT NULL,
  leads_found integer DEFAULT 0 NOT NULL,
  status text DEFAULT 'running' NOT NULL CHECK (status IN ('running', 'done', 'partial')),
  summary text,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS pending_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  agent_id uuid REFERENCES startup_agents(id) ON DELETE CASCADE NOT NULL,
  task_id uuid REFERENCES agent_tasks(id) ON DELETE CASCADE NOT NULL,
  action_type text NOT NULL CHECK (action_type IN ('send_email', 'post_content', 'create_file', 'api_call')),
  action_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text DEFAULT 'pending' NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at timestamptz DEFAULT now() NOT NULL,
  decided_at timestamptz
);

CREATE TABLE IF NOT EXISTS weekly_digests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  run_id uuid REFERENCES autonomous_runs(id) ON DELETE CASCADE NOT NULL,
  week_start date NOT NULL,
  content text NOT NULL,
  sent_to_email boolean DEFAULT false NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS agent_analytics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid REFERENCES startup_agents(id) ON DELETE CASCADE NOT NULL,
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  week_start date NOT NULL,
  tasks_completed integer DEFAULT 0 NOT NULL,
  tasks_failed integer DEFAULT 0 NOT NULL,
  avg_judge_score float DEFAULT 0 NOT NULL,
  avg_revision_rounds float DEFAULT 0 NOT NULL,
  emails_sent integer DEFAULT 0 NOT NULL,
  memories_created integer DEFAULT 0 NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(agent_id, project_id, week_start)
);

CREATE TABLE IF NOT EXISTS outreach_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  agent_id uuid REFERENCES startup_agents(id) ON DELETE CASCADE NOT NULL,
  company_name text NOT NULL,
  contact_name text,
  contact_email text,
  company_url text,
  company_size text,
  industry text,
  research_notes text,
  email_subject text,
  email_body text,
  email_sent boolean DEFAULT false NOT NULL,
  email_sent_at timestamptz,
  reply_received boolean DEFAULT false NOT NULL,
  status text DEFAULT 'researched' NOT NULL CHECK (status IN ('found', 'researched', 'drafted', 'sent', 'replied', 'converted')),
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(project_id, company_name)
);


-- -------------------------------------------------------------------------
-- 18. COUNCIL MATRIX & IMAGE GENERATION TABLES
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS council_matrix (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  manager_id UUID REFERENCES agents(id) ON DELETE CASCADE NOT NULL,
  claims JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS generated_images (
  id              uuid primary key default gen_random_uuid(),
  project_id      uuid references projects(id),
  agent_id        uuid,
  message_id      uuid,
  prompt          text not null,
  negative_prompt text,
  model           text not null default 'flux-pro',
  width           integer default 1024,
  height          integer default 1024,
  image_url       text not null,
  storage_path    text,
  task_context    text,
  created_at      timestamptz default now()
);


-- -------------------------------------------------------------------------
-- 19. ATOMIC INTERACTION ALTERS & FUNCTIONS
-- -------------------------------------------------------------------------
-- Alter agents table to support recursive tree architecture
ALTER TABLE agents
  ADD COLUMN IF NOT EXISTS parent_agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS depth INTEGER DEFAULT 1 NOT NULL,
  ADD COLUMN IF NOT EXISTS agent_mode TEXT DEFAULT 'executor' CHECK (agent_mode IN ('executor', 'manager')) NOT NULL,
  ADD COLUMN IF NOT EXISTS children_count INTEGER DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS children_done INTEGER DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS token_budget INTEGER DEFAULT 4000 NOT NULL,
  ADD COLUMN IF NOT EXISTS tokens_used INTEGER DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS summary TEXT;

-- Atomic counter increment for sub-agent completion
CREATE OR REPLACE FUNCTION increment_agent_children_done(parent_id UUID)
RETURNS INTEGER AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  UPDATE agents
  SET children_done = children_done + 1
  WHERE id = parent_id
  RETURNING children_done INTO updated_count;
  
  RETURN updated_count;
END;
$$ LANGUAGE plpgsql;

-- Atomic counter increment for token budget tracking
CREATE OR REPLACE FUNCTION increment_agent_tokens(agent_id UUID, tokens INTEGER)
RETURNS VOID AS $$
BEGIN
  UPDATE agents
  SET tokens_used = tokens_used + tokens
  WHERE id = agent_id;
END;
$$ LANGUAGE plpgsql;


-- -------------------------------------------------------------------------
-- 20. INDEXES FOR PERFORMANCE
-- -------------------------------------------------------------------------
-- Coding Agent
CREATE INDEX IF NOT EXISTS idx_coding_sessions_project_id ON coding_sessions(project_id);
CREATE INDEX IF NOT EXISTS idx_code_files_session_id ON code_files(session_id);
CREATE INDEX IF NOT EXISTS idx_code_reviews_session_id ON code_reviews(session_id);
CREATE INDEX IF NOT EXISTS idx_codebase_files_project_id ON codebase_files(project_id);
CREATE INDEX IF NOT EXISTS idx_codebase_files_session_id ON codebase_files(session_id);
CREATE INDEX IF NOT EXISTS idx_codebase_symbols_file_id ON codebase_symbols(file_id);
CREATE INDEX IF NOT EXISTS idx_deployment_monitors_project_id ON deployment_monitors(project_id);
CREATE INDEX IF NOT EXISTS idx_deployment_incidents_monitor_id ON deployment_incidents(monitor_id);
CREATE INDEX IF NOT EXISTS idx_code_teams_project_id ON code_teams(project_id);
CREATE INDEX IF NOT EXISTS idx_code_team_agents_team_id ON code_team_agents(team_id);

-- IVFFlat Vector Indexes for codebase similarity matching
CREATE INDEX IF NOT EXISTS codebase_files_embedding_idx ON codebase_files
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 10);

CREATE INDEX IF NOT EXISTS codebase_symbols_embedding_idx ON codebase_symbols
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 10);

-- Learning Loop
CREATE INDEX IF NOT EXISTS idx_agent_perf_logs_agent ON agent_performance_logs(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_perf_logs_project ON agent_performance_logs(project_id);
CREATE INDEX IF NOT EXISTS idx_agent_perf_logs_task ON agent_performance_logs(task_id);
CREATE INDEX IF NOT EXISTS idx_agent_learnings_agent ON agent_learnings(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_learnings_project ON agent_learnings(project_id);
CREATE INDEX IF NOT EXISTS idx_agent_strat_versions_agent ON agent_strategy_versions(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_strat_versions_project ON agent_strategy_versions(project_id);
CREATE INDEX IF NOT EXISTS idx_outcome_events_project ON outcome_events(project_id);
CREATE INDEX IF NOT EXISTS idx_outcome_events_agent ON outcome_events(agent_id);
CREATE INDEX IF NOT EXISTS idx_user_feedback_task ON user_feedback(task_id);

-- Briefings
CREATE INDEX IF NOT EXISTS idx_voice_briefings_project_id ON voice_briefings(project_id);
CREATE INDEX IF NOT EXISTS idx_voice_briefings_user_id ON voice_briefings(user_id);
CREATE INDEX IF NOT EXISTS idx_voice_briefings_date ON voice_briefings(briefing_date DESC);
CREATE INDEX IF NOT EXISTS idx_voice_briefings_status ON voice_briefings(status);
CREATE INDEX IF NOT EXISTS idx_briefing_configs_project_id ON briefing_configs(project_id);
CREATE INDEX IF NOT EXISTS idx_briefing_configs_user_id ON briefing_configs(user_id);

-- Procurement
CREATE INDEX IF NOT EXISTS idx_procurement_items_project_id ON procurement_items(project_id);
CREATE INDEX IF NOT EXISTS idx_procurement_alternatives_item_id ON procurement_alternatives(item_id);
CREATE INDEX IF NOT EXISTS idx_procurement_requests_project_id ON procurement_requests(project_id);
CREATE INDEX IF NOT EXISTS idx_procurement_items_renewal_date ON procurement_items(renewal_date);
CREATE INDEX IF NOT EXISTS idx_procurement_items_status ON procurement_items(status);

-- Price Watch
CREATE INDEX IF NOT EXISTS idx_price_watches_user ON price_watches(user_id);
CREATE INDEX IF NOT EXISTS idx_price_watches_project ON price_watches(project_id);
CREATE INDEX IF NOT EXISTS idx_price_history_watch ON price_history(watch_id);
CREATE INDEX IF NOT EXISTS idx_price_alerts_sent_watch ON price_alerts_sent(watch_id);

-- Startup Upgrades (Vector)
CREATE INDEX IF NOT EXISTS agent_memory_embedding_idx ON agent_memory
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 10);

-- Generated Images
CREATE INDEX IF NOT EXISTS idx_generated_images_project ON generated_images(project_id);
CREATE INDEX IF NOT EXISTS idx_generated_images_agent ON generated_images(agent_id);
CREATE INDEX IF NOT EXISTS idx_generated_images_message ON generated_images(message_id);
CREATE INDEX IF NOT EXISTS idx_generated_images_created ON generated_images(created_at desc);


-- -------------------------------------------------------------------------
-- 21. ROW LEVEL SECURITY (RLS) POLICIES
-- -------------------------------------------------------------------------
-- Coding Agent
ALTER TABLE coding_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE code_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE code_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE codebase_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE codebase_symbols ENABLE ROW LEVEL SECURITY;
ALTER TABLE deployment_monitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE deployment_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE code_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE code_team_agents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all for service role" ON coding_sessions;
CREATE POLICY "Allow all for service role" ON coding_sessions FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all for service role" ON code_files;
CREATE POLICY "Allow all for service role" ON code_files FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all for service role" ON code_reviews;
CREATE POLICY "Allow all for service role" ON code_reviews FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all for service role" ON codebase_files;
CREATE POLICY "Allow all for service role" ON codebase_files FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all for service role" ON codebase_symbols;
CREATE POLICY "Allow all for service role" ON codebase_symbols FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all for service role" ON deployment_monitors;
CREATE POLICY "Allow all for service role" ON deployment_monitors FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all for service role" ON deployment_incidents;
CREATE POLICY "Allow all for service role" ON deployment_incidents FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all for service role" ON code_teams;
CREATE POLICY "Allow all for service role" ON code_teams FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all for service role" ON code_team_agents;
CREATE POLICY "Allow all for service role" ON code_team_agents FOR ALL USING (true) WITH CHECK (true);

-- Learning Loop
ALTER TABLE agent_performance_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_learnings ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_strategy_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE outcome_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read/write agent_performance_logs" ON agent_performance_logs;
CREATE POLICY "Allow public read/write agent_performance_logs" ON agent_performance_logs FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public read/write agent_learnings" ON agent_learnings;
CREATE POLICY "Allow public read/write agent_learnings" ON agent_learnings FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public read/write agent_strategy_versions" ON agent_strategy_versions;
CREATE POLICY "Allow public read/write agent_strategy_versions" ON agent_strategy_versions FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public read/write outcome_events" ON outcome_events;
CREATE POLICY "Allow public read/write outcome_events" ON outcome_events FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public read/write user_feedback" ON user_feedback;
CREATE POLICY "Allow public read/write user_feedback" ON user_feedback FOR ALL USING (true) WITH CHECK (true);

-- Briefings
ALTER TABLE voice_briefings ENABLE ROW LEVEL SECURITY;
ALTER TABLE briefing_configs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own briefings" ON voice_briefings;
CREATE POLICY "Users can view their own briefings" ON voice_briefings FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own briefings" ON voice_briefings;
CREATE POLICY "Users can insert their own briefings" ON voice_briefings FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own briefings" ON voice_briefings;
CREATE POLICY "Users can update their own briefings" ON voice_briefings FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role full access to briefings" ON voice_briefings;
CREATE POLICY "Service role full access to briefings" ON voice_briefings FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Users can view their own briefing configs" ON briefing_configs;
CREATE POLICY "Users can view their own briefing configs" ON briefing_configs FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own briefing configs" ON briefing_configs;
CREATE POLICY "Users can insert their own briefing configs" ON briefing_configs FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own briefing configs" ON briefing_configs;
CREATE POLICY "Users can update their own briefing configs" ON briefing_configs FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role full access to briefing configs" ON briefing_configs;
CREATE POLICY "Service role full access to briefing configs" ON briefing_configs FOR ALL USING (auth.role() = 'service_role');

-- Procurement
ALTER TABLE procurement_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE procurement_alternatives ENABLE ROW LEVEL SECURITY;
ALTER TABLE procurement_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all for service role" ON procurement_items;
CREATE POLICY "Allow all for service role" ON procurement_items FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all for service role" ON procurement_alternatives;
CREATE POLICY "Allow all for service role" ON procurement_alternatives FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all for service role" ON procurement_requests;
CREATE POLICY "Allow all for service role" ON procurement_requests FOR ALL USING (true) WITH CHECK (true);

-- Webhook Configs
ALTER TABLE webhook_configs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read/write webhook_configs" ON webhook_configs;
CREATE POLICY "Allow public read/write webhook_configs" ON webhook_configs FOR ALL USING (true) WITH CHECK (true);

-- Price Watch
ALTER TABLE price_watches ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_alerts_sent ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read/write price_watches" ON price_watches;
CREATE POLICY "Allow public read/write price_watches" ON price_watches FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public read/write price_history" ON price_history;
CREATE POLICY "Allow public read/write price_history" ON price_history FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public read/write price_alerts_sent" ON price_alerts_sent;
CREATE POLICY "Allow public read/write price_alerts_sent" ON price_alerts_sent FOR ALL USING (true) WITH CHECK (true);

-- Live Canvas
ALTER TABLE canvases ENABLE ROW LEVEL SECURITY;
ALTER TABLE canvas_rows ENABLE ROW LEVEL SECURITY;
ALTER TABLE artifacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read/write canvases" ON canvases;
CREATE POLICY "Allow public read/write canvases" ON canvases FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public read/write canvas_rows" ON canvas_rows;
CREATE POLICY "Allow public read/write canvas_rows" ON canvas_rows FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public read/write artifacts" ON artifacts;
CREATE POLICY "Allow public read/write artifacts" ON artifacts FOR ALL USING (true) WITH CHECK (true);

-- Startup Agent System Upgrades
ALTER TABLE judge_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE autonomous_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE pending_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_digests ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE outreach_leads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read/write judge_evaluations" ON judge_evaluations;
CREATE POLICY "Allow public read/write judge_evaluations" ON judge_evaluations FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public read/write autonomous_runs" ON autonomous_runs;
CREATE POLICY "Allow public read/write autonomous_runs" ON autonomous_runs FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public read/write pending_approvals" ON pending_approvals;
CREATE POLICY "Allow public read/write pending_approvals" ON pending_approvals FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public read/write weekly_digests" ON weekly_digests;
CREATE POLICY "Allow public read/write weekly_digests" ON weekly_digests FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public read/write agent_analytics" ON agent_analytics;
CREATE POLICY "Allow public read/write agent_analytics" ON agent_analytics FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public read/write outreach_leads" ON outreach_leads;
CREATE POLICY "Allow public read/write outreach_leads" ON outreach_leads FOR ALL USING (true) WITH CHECK (true);

-- Council Matrix
ALTER TABLE council_matrix ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read/write council_matrix" ON council_matrix;
CREATE POLICY "Allow public read/write council_matrix" ON council_matrix FOR ALL USING (true) WITH CHECK (true);

-- Generated Images
ALTER TABLE generated_images ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role full access on generated_images" ON generated_images;
CREATE POLICY "Service role full access on generated_images" ON generated_images FOR ALL USING (true) WITH CHECK (true);


-- -------------------------------------------------------------------------
-- 22. REALTIME PUBLICATIONS
-- -------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    -- Competitive Ad Intelligence
    ALTER PUBLICATION supabase_realtime ADD TABLE competitor_ads;
    ALTER PUBLICATION supabase_realtime ADD TABLE ad_intelligence_reports;
    
    -- Coding Agent
    ALTER PUBLICATION supabase_realtime ADD TABLE code_files;
    ALTER PUBLICATION supabase_realtime ADD TABLE coding_sessions;
    ALTER PUBLICATION supabase_realtime ADD TABLE codebase_files;
    ALTER PUBLICATION supabase_realtime ADD TABLE codebase_symbols;
    ALTER PUBLICATION supabase_realtime ADD TABLE deployment_monitors;
    ALTER PUBLICATION supabase_realtime ADD TABLE deployment_incidents;
    ALTER PUBLICATION supabase_realtime ADD TABLE code_teams;
    ALTER PUBLICATION supabase_realtime ADD TABLE code_team_agents;
    
    -- Learning Loop
    ALTER PUBLICATION supabase_realtime ADD TABLE agent_learnings;
    ALTER PUBLICATION supabase_realtime ADD TABLE agent_strategy_versions;
    
    -- Briefings
    ALTER PUBLICATION supabase_realtime ADD TABLE voice_briefings;
    ALTER PUBLICATION supabase_realtime ADD TABLE briefing_configs;
    
    -- Due Diligence
    ALTER PUBLICATION supabase_realtime ADD TABLE dd_sections;
    
    -- Funding
    ALTER PUBLICATION supabase_realtime ADD TABLE funding_matches;
    
    -- Reputation
    ALTER PUBLICATION supabase_realtime ADD TABLE brand_mentions;
    
    -- Procurement
    ALTER PUBLICATION supabase_realtime ADD TABLE procurement_items;
    ALTER PUBLICATION supabase_realtime ADD TABLE procurement_alternatives;
    ALTER PUBLICATION supabase_realtime ADD TABLE procurement_requests;
    
    -- Health Checks
    ALTER PUBLICATION supabase_realtime ADD TABLE health_scans;
    ALTER PUBLICATION supabase_realtime ADD TABLE health_findings;
    
    -- Contracts
    ALTER PUBLICATION supabase_realtime ADD TABLE contracts;
    ALTER PUBLICATION supabase_realtime ADD TABLE contract_analysis;
    
    -- Webhook Configs
    ALTER PUBLICATION supabase_realtime ADD TABLE webhook_configs;
    
    -- Price Watches
    ALTER PUBLICATION supabase_realtime ADD TABLE price_watches;
    ALTER PUBLICATION supabase_realtime ADD TABLE price_history;
    
    -- Live Canvas
    ALTER PUBLICATION supabase_realtime ADD TABLE canvases;
    ALTER PUBLICATION supabase_realtime ADD TABLE canvas_rows;
    
    -- Startup Upgrades (Phase 3 & 4)
    ALTER PUBLICATION supabase_realtime ADD TABLE judge_evaluations;
    ALTER PUBLICATION supabase_realtime ADD TABLE autonomous_runs;
    ALTER PUBLICATION supabase_realtime ADD TABLE pending_approvals;
    
    -- Council Matrix
    ALTER PUBLICATION supabase_realtime ADD TABLE council_matrix;
    
    -- Generated Images
    ALTER PUBLICATION supabase_realtime ADD TABLE generated_images;
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN OTHERS THEN NULL;
END $$;


-- -------------------------------------------------------------------------
-- 23. BACKGROUND CRON JOB SCHEDULES (OPTIONAL/SAFE ENABLER)
-- -------------------------------------------------------------------------
-- This PL/pgSQL block schedules weekly and periodic background runs via pg_cron.
-- It will safely exit without errors if pg_cron is not enabled.
DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
  
    -- 1. Weekly Agent Run (Mondays 9:00 AM UTC)
    PERFORM cron.schedule('weekly-agent-run',
      '0 9 * * MON',
      $cron_job$ SELECT net.http_post(
        url := 'https://3rdmind.ai/api/cron/master',
        body := '{"trigger":"weekly_run"}'::jsonb,
        headers := jsonb_build_object(
          'Content-Type','application/json',
          'Authorization','Bearer ' || (SELECT value FROM private.settings WHERE key = 'cron_secret')
        )
      ); $cron_job$);

    -- 2. Check Agent Schedules (Every 15 minutes)
    PERFORM cron.schedule('check-schedules',
      '*/15 * * * *',
      $cron_job$ SELECT net.http_post(
        url := 'https://3rdmind.ai/api/cron/master',
        body := '{"trigger":"check_schedules"}'::jsonb,
        headers := jsonb_build_object(
          'Content-Type','application/json',
          'Authorization','Bearer ' || (SELECT value FROM private.settings WHERE key = 'cron_secret')
        )
      ); $cron_job$);

    -- 3. Daily CSO Lead Prospecting (Weekdays 9:00 AM UTC)
    PERFORM cron.schedule('daily-cso-outreach',
      '0 9 * * 1-5',
      $cron_job$ SELECT net.http_post(
        url := 'https://3rdmind.ai/api/cron/master',
        body := '{"trigger":"daily_cso"}'::jsonb,
        headers := jsonb_build_object(
          'Content-Type','application/json',
          'Authorization','Bearer ' || (SELECT value FROM private.settings WHERE key = 'cron_secret')
        )
      ); $cron_job$);

    -- 4. WeeklyDigest Newsletter Generation (Mondays 10:00 AM UTC)
    PERFORM cron.schedule('weekly-digest',
      '0 10 * * MON',
      $cron_job$ SELECT net.http_post(
        url := 'https://3rdmind.ai/api/cron/master',
        body := '{"trigger":"weekly_digest"}'::jsonb,
        headers := jsonb_build_object(
          'Content-Type','application/json',
          'Authorization','Bearer ' || (SELECT value FROM private.settings WHERE key = 'cron_secret')
        )
      ); $cron_job$);

    -- 5. Weekly Learning Extraction (Sundays 10:00 AM UTC)
    PERFORM cron.schedule('weekly-learning-extraction',
      '0 10 * * SUN',
      $cron_job$ SELECT net.http_post(
        url := 'https://3rdmind.ai/api/cron/master',
        body := '{"trigger":"extract_learnings"}'::jsonb,
        headers := jsonb_build_object(
          'Content-Type','application/json',
          'Authorization','Bearer ' || (SELECT value FROM private.settings WHERE key = 'cron_secret')
        )
      ); $cron_job$);

    -- 6. Price Watch Checks (Every 6 hours)
    PERFORM cron.schedule('price-watch-check',
      '0 */6 * * *',
      $cron_job$ SELECT net.http_post(
        url := 'https://3rdmind.ai/api/cron/master',
        body := '{"trigger":"price_watch"}'::jsonb,
        headers := jsonb_build_object(
          'Content-Type','application/json',
          'Authorization','Bearer ' || (SELECT value FROM private.settings WHERE key = 'cron_secret')
        )
      ); $cron_job$);

  END IF;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $do$;
