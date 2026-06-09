-- SQL Schema for 3RDMIND AI Due Diligence Engine

CREATE TABLE IF NOT EXISTS dd_reports (
  id              uuid PRIMARY KEY default gen_random_uuid(),
  project_id      uuid REFERENCES projects(id) ON DELETE CASCADE,
  user_id         uuid,
  target_name     text NOT NULL,
  target_url      text,
  target_domain   text,
  status          text default 'running' check (status in ('running','complete','failed')),
  report_data     jsonb default '{}',
  pdf_url         text,
  created_at      timestamptz default now()
);

CREATE TABLE IF NOT EXISTS dd_sections (
  id              uuid PRIMARY KEY default gen_random_uuid(),
  report_id       uuid REFERENCES dd_reports(id) ON DELETE CASCADE,
  section_type    text check (section_type in (
                  'market_size','competitors',
                  'founder_background','product',
                  'financials','red_flags',
                  'investment_thesis','summary')),
  title           text NOT NULL,
  content         text NOT NULL,
  data            jsonb default '{}',
  sources         jsonb default '[]',
  score           integer check (score >= 0 and score <= 100),
  status          text default 'pending' check (status in ('pending','complete','failed')),
  created_at      timestamptz default now()
);

-- Enable Realtime
alter publication supabase_realtime add table dd_sections;
alter table dd_sections replica identity full;
