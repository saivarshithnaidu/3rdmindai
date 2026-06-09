-- SQL Schema for 3RDMIND Grant & Funding Finder

CREATE TABLE IF NOT EXISTS funding_opportunities (
  id              uuid PRIMARY KEY default gen_random_uuid(),
  name            text NOT NULL,
  provider        text NOT NULL,
  type            text check (type in ('grant', 'accelerator', 'loan', 'equity', 'competition')),
  amount_min      bigint,
  amount_max      bigint,
  currency        text default 'INR',
  eligibility     text NOT NULL,
  deadline        date,
  application_url text NOT NULL,
  description     text NOT NULL,
  stage_fit       text[] default '{}',
  sector_fit      text[] default '{}',
  country         text default 'IN',
  source_url      text NOT NULL,
  is_active       boolean default true,
  last_verified   timestamptz default now(),
  created_at      timestamptz default now()
);

CREATE TABLE IF NOT EXISTS funding_matches (
  id              uuid PRIMARY KEY default gen_random_uuid(),
  project_id      uuid REFERENCES projects(id) ON DELETE CASCADE,
  opportunity_id  uuid REFERENCES funding_opportunities(id) ON DELETE CASCADE,
  match_score     integer check (match_score >= 0 and match_score <= 100),
  match_reasons   jsonb default '[]',
  status          text default 'new' check (status in ('new', 'interested', 'applying', 'submitted', 'won', 'lost')),
  application_draft text,
  alert_sent      boolean default false,
  created_at      timestamptz default now()
);

-- Enable Realtime
alter publication supabase_realtime add table funding_matches;
alter table funding_matches replica identity full;
