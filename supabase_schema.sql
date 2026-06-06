-- Create tables

-- Projects Table
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  goal TEXT NOT NULL,
  user_id UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Agents Table
CREATE TABLE IF NOT EXISTS agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  parent_agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  task TEXT,
  type TEXT CHECK (type IN ('orchestrator', 'subagent')) NOT NULL,
  agent_mode TEXT DEFAULT 'executor' CHECK (agent_mode IN ('executor', 'manager')) NOT NULL,
  depth INTEGER DEFAULT 1 NOT NULL,
  locked BOOLEAN DEFAULT false NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'done', 'error')) NOT NULL,
  model TEXT,
  children_count INTEGER DEFAULT 0 NOT NULL,
  children_done INTEGER DEFAULT 0 NOT NULL,
  token_budget INTEGER DEFAULT 4000 NOT NULL,
  tokens_used INTEGER DEFAULT 0 NOT NULL,
  summary TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Messages Table
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID REFERENCES agents(id) ON DELETE CASCADE NOT NULL,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  role TEXT CHECK (role IN ('user', 'assistant', 'auto', 'system')) NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable Row Level Security (RLS)
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies (Allow read/write for guest access / demo client & service operations)
DROP POLICY IF EXISTS "Allow public read/write projects" ON projects;
CREATE POLICY "Allow public read/write projects" ON projects
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public read/write agents" ON agents;
CREATE POLICY "Allow public read/write agents" ON agents
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public read/write messages" ON messages;
CREATE POLICY "Allow public read/write messages" ON messages
  FOR ALL USING (true) WITH CHECK (true);

-- Enable Supabase Realtime for agents and messages tables
-- (Attempts to add tables to the publication. Realtime service must be enabled in Supabase)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE agents;
    ALTER PUBLICATION supabase_realtime ADD TABLE messages;
  END IF;
EXCEPTION
  WHEN duplicate_object THEN
    -- Table is already in the publication, ignore
    NULL;
  WHEN OTHERS THEN
    -- Other publication errors, ignore for local setup compatibility
    NULL;
END $$;
