-- SQL Schema for 3RDMIND Contract Intelligence

CREATE TABLE IF NOT EXISTS contracts (
  id              uuid PRIMARY KEY default gen_random_uuid(),
  project_id      uuid REFERENCES projects(id) ON DELETE CASCADE,
  user_id         uuid,
  name            text NOT NULL,
  contract_type   text check (contract_type in ('nda', 'client', 'employment', 'founder', 'vendor', 'other')),
  original_text   text NOT NULL,
  file_url        text,
  status          text default 'analyzing' check (status in ('analyzing', 'complete', 'failed')),
  created_at      timestamptz default now()
);

CREATE TABLE IF NOT EXISTS contract_analysis (
  id              uuid PRIMARY KEY default gen_random_uuid(),
  contract_id     uuid REFERENCES contracts(id) ON DELETE CASCADE,
  risk_level      text check (risk_level in ('high', 'medium', 'low')),
  risky_clauses   jsonb default '[]',
  missing_clauses jsonb default '[]',
  negotiation_pts jsonb default '[]',
  plain_summary   text NOT NULL,
  counter_proposal text,
  overall_score   integer check (overall_score >= 0 and overall_score <= 100),
  created_at      timestamptz default now()
);

CREATE TABLE IF NOT EXISTS contract_templates (
  id              uuid PRIMARY KEY default gen_random_uuid(),
  project_id      uuid REFERENCES projects(id) ON DELETE CASCADE,
  template_type   text NOT NULL,
  content         text NOT NULL,
  variables       jsonb default '[]',
  created_at      timestamptz default now()
);

-- Enable Realtime for live updates
alter publication supabase_realtime add table contracts;
alter table contracts replica identity full;

alter publication supabase_realtime add table contract_analysis;
alter table contract_analysis replica identity full;
