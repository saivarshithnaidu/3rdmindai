-- SQL Schema for 3RDMIND Coding Agent Next Level Upgrade
-- Enable vector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- 1. Alter coding_sessions with execution metrics
ALTER TABLE coding_sessions
  ADD COLUMN IF NOT EXISTS all_tests_passing boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS execution_output text,
  ADD COLUMN IF NOT EXISTS fix_rounds integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sandbox_id text;

-- 2. codebase_files: tracks all source files indexed in the project
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

-- 3. codebase_symbols: tracks code signatures, declarations, and descriptions
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

-- 4. deployment_monitors: tracks deployed urls and uptime stats
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

-- 5. deployment_incidents: logs production downtime/incident resolution
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

-- 6. code_teams: lists multi-agent coding sessions
CREATE TABLE IF NOT EXISTS code_teams (
  id              uuid PRIMARY KEY default gen_random_uuid(),
  project_id      uuid REFERENCES projects(id) ON DELETE CASCADE,
  session_id      uuid REFERENCES coding_sessions(id) ON DELETE CASCADE,
  description     text NOT NULL,
  status          text DEFAULT 'planning' NOT NULL,
  created_at      timestamptz DEFAULT now()
);

-- 7. code_team_agents: individual specialized agent roles and statuses
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

-- 8. Vector search helper functions
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

-- 9. Performance indexes
CREATE INDEX IF NOT EXISTS idx_codebase_files_project_id ON codebase_files(project_id);
CREATE INDEX IF NOT EXISTS idx_codebase_files_session_id ON codebase_files(session_id);
CREATE INDEX IF NOT EXISTS idx_codebase_symbols_file_id ON codebase_symbols(file_id);
CREATE INDEX IF NOT EXISTS idx_deployment_monitors_project_id ON deployment_monitors(project_id);
CREATE INDEX IF NOT EXISTS idx_deployment_incidents_monitor_id ON deployment_incidents(monitor_id);
CREATE INDEX IF NOT EXISTS idx_code_teams_project_id ON code_teams(project_id);
CREATE INDEX IF NOT EXISTS idx_code_team_agents_team_id ON code_team_agents(team_id);

-- 10. pgvector ivfflat indexes (using cosine similarity)
-- Note: lists=10 is used here since initial tables are small, can scale to 100 later
CREATE INDEX IF NOT EXISTS codebase_files_embedding_idx ON codebase_files
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 10);

CREATE INDEX IF NOT EXISTS codebase_symbols_embedding_idx ON codebase_symbols
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 10);

-- Enable RLS
ALTER TABLE codebase_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE codebase_symbols ENABLE ROW LEVEL SECURITY;
ALTER TABLE deployment_monitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE deployment_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE code_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE code_team_agents ENABLE ROW LEVEL SECURITY;

-- Allow all access for service role
CREATE POLICY "Allow all for service role" ON codebase_files FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for service role" ON codebase_symbols FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for service role" ON deployment_monitors FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for service role" ON deployment_incidents FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for service role" ON code_teams FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for service role" ON code_team_agents FOR ALL USING (true) WITH CHECK (true);

-- Enable Realtime
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE codebase_files;
    ALTER PUBLICATION supabase_realtime ADD TABLE codebase_symbols;
    ALTER PUBLICATION supabase_realtime ADD TABLE deployment_monitors;
    ALTER PUBLICATION supabase_realtime ADD TABLE deployment_incidents;
    ALTER PUBLICATION supabase_realtime ADD TABLE code_teams;
    ALTER PUBLICATION supabase_realtime ADD TABLE code_team_agents;
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN OTHERS THEN NULL;
END $$;
