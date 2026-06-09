-- SQL Schema for 3RDMIND Website Health Checker

CREATE TABLE IF NOT EXISTS health_scans (
  id              uuid PRIMARY KEY default gen_random_uuid(),
  project_id      uuid REFERENCES projects(id) ON DELETE CASCADE,
  user_id         uuid,
  target_url      text NOT NULL,
  status          text default 'running' check (status in ('running', 'complete', 'failed')),
  score           integer check (score >= 0 and score <= 100),
  checks_passed   integer default 0,
  checks_failed   integer default 0,
  created_at      timestamptz default now()
);

CREATE TABLE IF NOT EXISTS health_findings (
  id              uuid PRIMARY KEY default gen_random_uuid(),
  scan_id         uuid REFERENCES health_scans(id) ON DELETE CASCADE,
  category        text NOT NULL check (category in ('performance', 'seo', 'accessibility', 'configuration', 'security')),
  priority        text NOT NULL check (priority in ('high', 'medium', 'low', 'info')),
  title           text NOT NULL,
  description     text NOT NULL,
  recommendation  text NOT NULL,
  docs_url        text,
  created_at      timestamptz default now()
);

-- Enable Realtime
alter publication supabase_realtime add table health_scans;
alter table health_scans replica identity full;

alter publication supabase_realtime add table health_findings;
alter table health_findings replica identity full;
