-- Supabase Migration: Self-Improving Loop Tables
-- Run this in your Supabase SQL Editor

-- 1. Create agent_performance_logs table
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

-- 2. Create agent_learnings table
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

-- 3. Create agent_strategy_versions table
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

-- 4. Create outcome_events table
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

-- 5. Create user_feedback table
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

-- Enable RLS (Row Level Security) on all new tables
ALTER TABLE agent_performance_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_learnings ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_strategy_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE outcome_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_feedback ENABLE ROW LEVEL SECURITY;

-- Allow public read/write access (matching 3RDMIND policies)
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

-- Enable Supabase Realtime for agent_learnings and agent_strategy_versions
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE agent_learnings;
    ALTER PUBLICATION supabase_realtime ADD TABLE agent_strategy_versions;
  END IF;
EXCEPTION
  WHEN duplicate_object THEN
    NULL;
  WHEN OTHERS THEN
    NULL;
END $$;

-- Indexes for performance
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

-- Register pg_cron schedule check (hits master cron router every Sunday at 10am UTC)
SELECT cron.schedule(
  'weekly-learning-extraction',
  '0 10 * * SUN',
  $$ SELECT net.http_post(
    url := 'https://3rdmind.ai/api/cron/master',
    body := '{"trigger":"extract_learnings"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'Authorization','Bearer ' || (SELECT value FROM private.settings WHERE key = 'cron_secret')
    )
  ); $$
);
