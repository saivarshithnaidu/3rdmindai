-- Supabase Migration: Live Browser Agent Sessions
-- Apply this to the Supabase Database SQL Editor

-- Create browser_sessions table
CREATE TABLE IF NOT EXISTS browser_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  agent_id UUID REFERENCES startup_agents(id) ON DELETE SET NULL,
  canvas_id UUID REFERENCES canvases(id) ON DELETE SET NULL,
  session_id TEXT NOT NULL,
  live_view_url TEXT NOT NULL,
  current_url TEXT, -- Store current active browser URL
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'error')) NOT NULL,
  scraper_type TEXT NOT NULL,
  query TEXT NOT NULL,
  rows_extracted INTEGER DEFAULT 0 NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Indexing for fast queries
CREATE INDEX IF NOT EXISTS idx_browser_sessions_project ON browser_sessions(project_id);
CREATE INDEX IF NOT EXISTS idx_browser_sessions_agent ON browser_sessions(agent_id);

-- Enable Row Level Security (RLS)
ALTER TABLE browser_sessions ENABLE ROW LEVEL SECURITY;

-- Add public read/write policies (same as other tables in 3RDMIND)
DROP POLICY IF EXISTS "Allow public read/write browser_sessions" ON browser_sessions;
CREATE POLICY "Allow public read/write browser_sessions" ON browser_sessions FOR ALL USING (true) WITH CHECK (true);

-- Enable Supabase Realtime for browser_sessions
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE browser_sessions;
  END IF;
EXCEPTION
  WHEN duplicate_object THEN
    NULL;
  WHEN OTHERS THEN
    NULL;
END $$;
