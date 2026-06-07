-- Supabase Migration: Startup Agent System Phase 3 & 4
-- Apply this to the Supabase Database SQL Editor

-- 1. Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Alter agent_memory Table
ALTER TABLE agent_memory ADD COLUMN IF NOT EXISTS embedding vector(1536) NULL;

-- 3. Create match_agent_memories Similarity Search Function
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

-- 4. Create ivfflat index on agent_memory (Note: lists=10 is used here since initial tables are small, can scale to 100 later)
CREATE INDEX IF NOT EXISTS agent_memory_embedding_idx ON agent_memory
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 10);

-- 5. Alter agent_tasks Table
ALTER TABLE agent_tasks ADD COLUMN IF NOT EXISTS judge_score integer NULL CHECK (judge_score >= 0 AND judge_score <= 50);
ALTER TABLE agent_tasks ADD COLUMN IF NOT EXISTS judge_feedback text NULL;
ALTER TABLE agent_tasks ADD COLUMN IF NOT EXISTS judge_passed boolean NULL;
ALTER TABLE agent_tasks ADD COLUMN IF NOT EXISTS revision_round integer DEFAULT 0 NOT NULL;
ALTER TABLE agent_tasks ADD COLUMN IF NOT EXISTS revision_of_task_id uuid REFERENCES agent_tasks(id) ON DELETE SET NULL;
ALTER TABLE agent_tasks ADD COLUMN IF NOT EXISTS final_status text DEFAULT 'done' NOT NULL CHECK (final_status IN ('done', 'done_with_warnings', 'failed_quality'));

-- 6. Alter projects Table
ALTER TABLE projects ADD COLUMN IF NOT EXISTS autonomous_mode boolean DEFAULT false NOT NULL;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS autonomous_level text DEFAULT 'supervised' NOT NULL CHECK (autonomous_level IN ('supervised', 'semi-auto', 'full-auto'));

-- 7. Create judge_evaluations Table
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

-- 8. Create autonomous_runs Table
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

-- 9. Create pending_approvals Table
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

-- 10. Create weekly_digests Table
CREATE TABLE IF NOT EXISTS weekly_digests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  run_id uuid REFERENCES autonomous_runs(id) ON DELETE CASCADE NOT NULL,
  week_start date NOT NULL,
  content text NOT NULL,
  sent_to_email boolean DEFAULT false NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- 11. Create agent_analytics Table
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

-- 12. Create outreach_leads Table
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

-- 13. Enable Row Level Security (RLS) on all new tables
ALTER TABLE judge_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE autonomous_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE pending_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_digests ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE outreach_leads ENABLE ROW LEVEL SECURITY;

-- 14. Create public policies (compatible with the rest of the 3RDMIND app)
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

-- 15. Enable Supabase Realtime for judge_evaluations, autonomous_runs, pending_approvals
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE judge_evaluations;
    ALTER PUBLICATION supabase_realtime ADD TABLE autonomous_runs;
    ALTER PUBLICATION supabase_realtime ADD TABLE pending_approvals;
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN OTHERS THEN NULL;
END $$;
