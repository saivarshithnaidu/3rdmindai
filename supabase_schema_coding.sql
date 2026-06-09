-- SQL Schema for 3RDMIND AI Coding Agent

-- coding_sessions: tracks coding activities and modes
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

-- code_files: tracks individual source code files within a session
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

-- code_reviews: tracks issues, suggestions, and security flags for reviewed code
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

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_coding_sessions_project_id ON coding_sessions(project_id);
CREATE INDEX IF NOT EXISTS idx_code_files_session_id ON code_files(session_id);
CREATE INDEX IF NOT EXISTS idx_code_reviews_session_id ON code_reviews(session_id);

-- Enable Row Level Security (RLS)
ALTER TABLE coding_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE code_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE code_reviews ENABLE ROW LEVEL SECURITY;

-- Allow all operations for service role
CREATE POLICY "Allow all for service role" ON coding_sessions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for service role" ON code_files FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for service role" ON code_reviews FOR ALL USING (true) WITH CHECK (true);

-- Enable Realtime for code_files and coding_sessions
ALTER PUBLICATION supabase_realtime ADD TABLE code_files;
ALTER TABLE code_files REPLICA IDENTITY FULL;

ALTER PUBLICATION supabase_realtime ADD TABLE coding_sessions;
ALTER TABLE coding_sessions REPLICA IDENTITY FULL;
