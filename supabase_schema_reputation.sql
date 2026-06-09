-- SQL Schema for 3RDMIND Reputation Monitor

CREATE TABLE IF NOT EXISTS reputation_monitors (
  id              uuid PRIMARY KEY default gen_random_uuid(),
  project_id      uuid REFERENCES projects(id) ON DELETE CASCADE,
  brand_name      text NOT NULL,
  keywords        text[] default '{}',
  platforms       text[] default '{}',
  check_interval  integer default 24,
  auto_respond    boolean default false,
  last_checked_at timestamptz,
  created_at      timestamptz default now()
);

CREATE TABLE IF NOT EXISTS brand_mentions (
  id              uuid PRIMARY KEY default gen_random_uuid(),
  monitor_id      uuid REFERENCES reputation_monitors(id) ON DELETE CASCADE,
  platform        text NOT NULL,
  source_url      text NOT NULL,
  author          text,
  content         text NOT NULL,
  sentiment       text check (sentiment in ('positive','neutral','negative')),
  sentiment_score float check (sentiment_score >= -1.0 and sentiment_score <= 1.0),
  urgency         text check (urgency in ('critical','high','medium','low')),
  response_draft  text,
  response_sent   boolean default false,
  response_url    text,
  found_at        timestamptz default now()
);

CREATE TABLE IF NOT EXISTS reputation_reports (
  id              uuid PRIMARY KEY default gen_random_uuid(),
  monitor_id      uuid REFERENCES reputation_monitors(id) ON DELETE CASCADE,
  week_start      date NOT NULL,
  total_mentions  integer default 0,
  positive_count  integer default 0,
  neutral_count   integer default 0,
  negative_count  integer default 0,
  avg_sentiment   float default 0.0,
  top_topics      jsonb default '{}',
  summary         text,
  created_at      timestamptz default now()
);

-- Enable Realtime
alter publication supabase_realtime add table brand_mentions;
alter table brand_mentions replica identity full;
