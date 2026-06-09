-- SQL Schema for 3RDMIND Competitive Ad Intelligence System

-- 1. Competitor Profiles Table
CREATE TABLE IF NOT EXISTS competitor_profiles (
  id              uuid PRIMARY KEY default gen_random_uuid(),
  project_id      uuid REFERENCES projects(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL,
  competitor_url  text NOT NULL,
  competitor_name text NOT NULL,
  competitor_domain text NOT NULL,
  google_ads_id   text,
  meta_page_id    text,
  linkedin_id     text,
  last_scraped_at timestamptz,
  created_at      timestamptz default now()
);

-- 2. Competitor Ads Table
CREATE TABLE IF NOT EXISTS competitor_ads (
  id              uuid PRIMARY KEY default gen_random_uuid(),
  competitor_id   uuid REFERENCES competitor_profiles(id) ON DELETE CASCADE,
  platform        text check (platform in ('google','meta','linkedin','tiktok')),
  ad_id           text,
  headline        text,
  body            text,
  cta             text,
  image_url       text,
  video_url       text,
  landing_url     text,
  start_date      date,
  is_active       boolean default true,
  running_days    integer,
  impressions_min integer,
  impressions_max integer,
  spend_min       integer,
  spend_max       integer,
  platforms_used  text[],
  raw_data        jsonb default '{}',
  scraped_at      timestamptz default now()
);

-- 3. Ad Intelligence Reports Table
CREATE TABLE IF NOT EXISTS ad_intelligence_reports (
  id              uuid PRIMARY KEY default gen_random_uuid(),
  project_id      uuid REFERENCES projects(id) ON DELETE CASCADE,
  competitor_id   uuid REFERENCES competitor_profiles(id) ON DELETE CASCADE,
  report_type     text check (report_type in ('full','quick','update')),
  total_ads_found integer default 0,
  active_ads      integer default 0,
  top_angles      jsonb default '[]',
  top_ctas        jsonb default '[]',
  top_formats     jsonb default '[]',
  winning_ads     jsonb default '[]',
  insights        text,
  generated_at    timestamptz default now()
);

-- 4. Generated Campaigns Table
CREATE TABLE IF NOT EXISTS generated_campaigns (
  id              uuid PRIMARY KEY default gen_random_uuid(),
  project_id      uuid REFERENCES projects(id) ON DELETE CASCADE,
  competitor_id   uuid REFERENCES competitor_profiles(id) ON DELETE SET NULL,
  report_id       uuid REFERENCES ad_intelligence_reports(id) ON DELETE SET NULL,
  platform        text NOT NULL,
  campaign_name   text NOT NULL,
  target_audience text NOT NULL,
  ad_variations   jsonb default '[]',
  strategy        text,
  status          text default 'draft' check (status in ('draft','approved','running')),
  created_at      timestamptz default now()
);

-- 5. Enable Realtime on competitor_ads and ad_intelligence_reports
alter publication supabase_realtime add table competitor_ads;
alter publication supabase_realtime add table ad_intelligence_reports;
