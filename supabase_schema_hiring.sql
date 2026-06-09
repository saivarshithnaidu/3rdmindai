-- SQL Schema for 3RDMIND AI Hiring Agent

CREATE TABLE IF NOT EXISTS job_postings (
  id              uuid PRIMARY KEY default gen_random_uuid(),
  project_id      uuid REFERENCES projects(id) ON DELETE CASCADE,
  title           text NOT NULL,
  department      text NOT NULL,
  location        text NOT NULL,
  work_type       text default 'remote' check (work_type in ('remote','hybrid','onsite')),
  salary_min      integer,
  salary_max      integer,
  currency        text default 'INR',
  requirements    text NOT NULL,
  nice_to_have    text,
  jd_content      text,
  status          text default 'draft' check (status in ('draft','active','closed')),
  created_at      timestamptz default now()
);

CREATE TABLE IF NOT EXISTS candidates (
  id              uuid PRIMARY KEY default gen_random_uuid(),
  job_id          uuid REFERENCES job_postings(id) ON DELETE CASCADE,
  name            text NOT NULL,
  email           text,
  linkedin_url    text,
  resume_url      text,
  resume_text     text,
  source          text default 'linkedin' check (source in ('linkedin','naukri','manual','referral')),
  match_score     integer check (match_score >= 0 and match_score <= 100),
  score_breakdown jsonb default '{}',
  status          text default 'new' check (status in ('new','screening','interview','assessment','offer','rejected','hired')),
  notes           text,
  created_at      timestamptz default now()
);

CREATE TABLE IF NOT EXISTS candidate_emails (
  id              uuid PRIMARY KEY default gen_random_uuid(),
  candidate_id    uuid REFERENCES candidates(id) ON DELETE CASCADE,
  email_type      text check (email_type in ('invite','rejection','followup','offer')),
  subject         text NOT NULL,
  body            text NOT NULL,
  sent_at         timestamptz,
  opened          boolean default false,
  created_at      timestamptz default now()
);

CREATE TABLE IF NOT EXISTS interviews (
  id              uuid PRIMARY KEY default gen_random_uuid(),
  candidate_id    uuid REFERENCES candidates(id) ON DELETE CASCADE,
  job_id          uuid REFERENCES job_postings(id) ON DELETE CASCADE,
  scheduled_at    timestamptz NOT NULL,
  duration_mins   integer default 60,
  interview_type  text default 'technical' check (interview_type in ('screening','technical','cultural','final')),
  questions       jsonb default '[]',
  assessment      text,
  outcome         text,
  calendar_event_id text,
  created_at      timestamptz default now()
);
