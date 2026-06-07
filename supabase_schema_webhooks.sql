-- Supabase Migration: Webhook Configurations Table
-- Apply this in the Supabase Database SQL Editor

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

-- Enable Row Level Security (RLS)
ALTER TABLE webhook_configs ENABLE ROW LEVEL SECURITY;

-- Add public read/write access policies (same as other tables in 3RDMIND)
DROP POLICY IF EXISTS "Allow public read/write webhook_configs" ON webhook_configs;
CREATE POLICY "Allow public read/write webhook_configs" ON webhook_configs 
  FOR ALL USING (true) WITH CHECK (true);

-- Enable Supabase Realtime for webhook_configs if realtime publication exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE webhook_configs;
  END IF;
EXCEPTION
  WHEN duplicate_object THEN
    NULL;
  WHEN OTHERS THEN
    NULL;
END $$;
