-- Supabase Migration: Background Execution pg_cron Setup
-- Run this in your Supabase SQL Editor

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Create a secure private schema for database configuration settings (not exposed to PostgREST API)
CREATE SCHEMA IF NOT EXISTS private;

-- Create settings table to store secrets securely
CREATE TABLE IF NOT EXISTS private.settings (
  key text PRIMARY KEY,
  value text NOT NULL
);

-- IMPORTANT: Replace 'your_cron_secret_here' with your actual CRON_SECRET value.
INSERT INTO private.settings (key, value)
VALUES ('cron_secret', 'your_cron_secret_here')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- Schedule the 4 cron jobs hitting the unified master endpoint.

-- 1. Weekly Agent Run (Mondays 9:00 AM)
SELECT cron.schedule('weekly-agent-run',
  '0 9 * * MON',
  $$ SELECT net.http_post(
    url := 'https://3rdmind.ai/api/cron/master',
    body := '{"trigger":"weekly_run"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'Authorization','Bearer ' || (SELECT value FROM private.settings WHERE key = 'cron_secret')
    )
  ); $$);

-- 2. Check Agent Schedules (Every 15 minutes)
SELECT cron.schedule('check-schedules',
  '*/15 * * * *',
  $$ SELECT net.http_post(
    url := 'https://3rdmind.ai/api/cron/master',
    body := '{"trigger":"check_schedules"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'Authorization','Bearer ' || (SELECT value FROM private.settings WHERE key = 'cron_secret')
    )
  ); $$);

-- 3. Daily CSO Lead Prospecting (Weekdays 9:00 AM)
SELECT cron.schedule('daily-cso-outreach',
  '0 9 * * 1-5',
  $$ SELECT net.http_post(
    url := 'https://3rdmind.ai/api/cron/master',
    body := '{"trigger":"daily_cso"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'Authorization','Bearer ' || (SELECT value FROM private.settings WHERE key = 'cron_secret')
    )
  ); $$);

-- 4. WeeklyDigest Newsletter Generation (Mondays 10:00 AM)
SELECT cron.schedule('weekly-digest',
  '0 10 * * MON',
  $$ SELECT net.http_post(
    url := 'https://3rdmind.ai/api/cron/master',
    body := '{"trigger":"weekly_digest"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'Authorization','Bearer ' || (SELECT value FROM private.settings WHERE key = 'cron_secret')
    )
  ); $$);
