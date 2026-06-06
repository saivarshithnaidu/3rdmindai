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

-- Alter projects table to support master resume uploading & indexing
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS master_resume TEXT,
  ADD COLUMN IF NOT EXISTS master_resume_filename TEXT;
