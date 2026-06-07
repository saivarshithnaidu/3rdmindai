-- Supabase Migration: Startup Agent System
-- Apply this to the Supabase Database SQL Editor

-- 1. Create startup_agents Table
CREATE TABLE IF NOT EXISTS startup_agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  role TEXT CHECK (role IN ('ceo', 'cmo', 'cto', 'cfo', 'cso', 'cro')) NOT NULL,
  name TEXT NOT NULL,
  model TEXT DEFAULT 'deepseek/deepseek-chat' NOT NULL,
  is_active BOOLEAN DEFAULT true NOT NULL,
  last_run_at TIMESTAMPTZ,
  tasks_completed INTEGER DEFAULT 0 NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(project_id, role)
);

-- 2. Create agent_tasks Table
CREATE TABLE IF NOT EXISTS agent_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID REFERENCES startup_agents(id) ON DELETE CASCADE NOT NULL,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'done', 'failed')) NOT NULL,
  output TEXT,
  tools_used JSONB DEFAULT '[]'::jsonb NOT NULL,
  triggered_by TEXT CHECK (triggered_by IN ('user', 'agent', 'schedule')) NOT NULL,
  triggered_by_agent_id UUID,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 3. Create agent_memory Table
CREATE TABLE IF NOT EXISTS agent_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID REFERENCES startup_agents(id) ON DELETE CASCADE NOT NULL,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  memory_type TEXT CHECK (memory_type IN ('decision', 'output', 'fact', 'preference', 'learning')) NOT NULL,
  content TEXT NOT NULL,
  source_task_id UUID REFERENCES agent_tasks(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 4. Create agent_messages Table
CREATE TABLE IF NOT EXISTS agent_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_agent_id UUID REFERENCES startup_agents(id) ON DELETE CASCADE NOT NULL,
  to_agent_id UUID REFERENCES startup_agents(id) ON DELETE CASCADE NOT NULL,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  subject TEXT NOT NULL,
  content TEXT NOT NULL,
  read BOOLEAN DEFAULT false NOT NULL,
  reply_task_id UUID REFERENCES agent_tasks(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 5. Create agent_schedules Table
CREATE TABLE IF NOT EXISTS agent_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID REFERENCES startup_agents(id) ON DELETE CASCADE NOT NULL,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  task_template TEXT NOT NULL,
  cron_expression TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true NOT NULL,
  last_triggered TIMESTAMPTZ,
  next_trigger TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Enable Row Level Security (RLS)
ALTER TABLE startup_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_schedules ENABLE ROW LEVEL SECURITY;

-- Add public read/write policies (same as other tables in 3RDMIND)
DROP POLICY IF EXISTS "Allow public read/write startup_agents" ON startup_agents;
CREATE POLICY "Allow public read/write startup_agents" ON startup_agents FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public read/write agent_tasks" ON agent_tasks;
CREATE POLICY "Allow public read/write agent_tasks" ON agent_tasks FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public read/write agent_memory" ON agent_memory;
CREATE POLICY "Allow public read/write agent_memory" ON agent_memory FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public read/write agent_messages" ON agent_messages;
CREATE POLICY "Allow public read/write agent_messages" ON agent_messages FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public read/write agent_schedules" ON agent_schedules;
CREATE POLICY "Allow public read/write agent_schedules" ON agent_schedules FOR ALL USING (true) WITH CHECK (true);

-- Enable Supabase Realtime for startup_agents, agent_tasks, and agent_messages
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE startup_agents;
    ALTER PUBLICATION supabase_realtime ADD TABLE agent_tasks;
    ALTER PUBLICATION supabase_realtime ADD TABLE agent_messages;
  END IF;
EXCEPTION
  WHEN duplicate_object THEN
    NULL;
  WHEN OTHERS THEN
    NULL;
END $$;
