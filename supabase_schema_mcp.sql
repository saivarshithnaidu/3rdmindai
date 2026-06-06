-- MCP Connector Schema
-- Create table: connectors
CREATE TABLE IF NOT EXISTS connectors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  user_id UUID,
  name TEXT NOT NULL,
  server_url TEXT NOT NULL,
  auth_type TEXT NOT NULL CHECK (auth_type IN ('api_key', 'oauth', 'none')),
  api_key TEXT,
  oauth_token TEXT,
  is_active BOOLEAN DEFAULT false NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Create table: tool_calls
CREATE TABLE IF NOT EXISTS tool_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  agent_id UUID REFERENCES agents(id) ON DELETE CASCADE NOT NULL,
  message_id UUID REFERENCES messages(id) ON DELETE SET NULL,
  connector_id UUID REFERENCES connectors(id) ON DELETE CASCADE NOT NULL,
  tool_name TEXT NOT NULL,
  params JSONB DEFAULT '{}'::jsonb NOT NULL,
  result JSONB DEFAULT '{}'::jsonb,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'done', 'error')) NOT NULL,
  duration_ms INTEGER DEFAULT 0 NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE connectors ENABLE ROW LEVEL SECURITY;
ALTER TABLE tool_calls ENABLE ROW LEVEL SECURITY;

-- Allow public read/write (demo client mode compatibility)
DROP POLICY IF EXISTS "Allow public read/write connectors" ON connectors;
CREATE POLICY "Allow public read/write connectors" ON connectors
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public read/write tool_calls" ON tool_calls;
CREATE POLICY "Allow public read/write tool_calls" ON tool_calls
  FOR ALL USING (true) WITH CHECK (true);

-- Enable Supabase Realtime for tool_calls table
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE tool_calls;
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN OTHERS THEN NULL;
END $$;
