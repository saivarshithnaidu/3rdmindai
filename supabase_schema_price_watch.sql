-- Supabase Migration: Price Watch Agent Tables
-- Run this in your Supabase SQL Editor

-- 1. Create price_watches table
CREATE TABLE IF NOT EXISTS price_watches (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL,
  project_id      UUID REFERENCES projects(id) ON DELETE CASCADE,
  product_name    TEXT NOT NULL,
  product_url     TEXT NOT NULL,
  platform        TEXT CHECK (platform IN ('amazon','flipkart','meesho','custom')) NOT NULL,
  target_price    NUMERIC(10,2) NOT NULL,
  current_price   NUMERIC(10,2),
  original_price  NUMERIC(10,2),
  lowest_price    NUMERIC(10,2),
  currency        TEXT DEFAULT 'INR' NOT NULL,
  check_interval  INTEGER DEFAULT 6 NOT NULL,
  alert_email     TEXT,
  alert_whatsapp  TEXT,
  image_url       TEXT,
  status          TEXT DEFAULT 'watching' CHECK (status IN ('watching','triggered','paused','expired')) NOT NULL,
  triggered_at    TIMESTAMPTZ,
  last_checked_at TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 2. Create price_history table
CREATE TABLE IF NOT EXISTS price_history (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  watch_id        UUID REFERENCES price_watches(id) ON DELETE CASCADE NOT NULL,
  price           NUMERIC(10,2) NOT NULL,
  in_stock        BOOLEAN DEFAULT true NOT NULL,
  deal_score      INTEGER DEFAULT 0 NOT NULL,
  scraped_at      TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 3. Create price_alerts_sent table
CREATE TABLE IF NOT EXISTS price_alerts_sent (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  watch_id        UUID REFERENCES price_watches(id) ON DELETE CASCADE NOT NULL,
  channel         TEXT CHECK (channel IN ('email','whatsapp')) NOT NULL,
  message         TEXT NOT NULL,
  sent_at         TIMESTAMPTZ DEFAULT now() NOT NULL,
  delivered       BOOLEAN DEFAULT false NOT NULL
);

-- Enable RLS (Row Level Security) on all tables
ALTER TABLE price_watches ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_alerts_sent ENABLE ROW LEVEL SECURITY;

-- Allow public read/write access (matching 3RDMIND policies)
DROP POLICY IF EXISTS "Allow public read/write price_watches" ON price_watches;
CREATE POLICY "Allow public read/write price_watches" ON price_watches FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public read/write price_history" ON price_history;
CREATE POLICY "Allow public read/write price_history" ON price_history FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public read/write price_alerts_sent" ON price_alerts_sent;
CREATE POLICY "Allow public read/write price_alerts_sent" ON price_alerts_sent FOR ALL USING (true) WITH CHECK (true);

-- Enable Supabase Realtime for price_watches and price_history
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE price_watches;
    ALTER PUBLICATION supabase_realtime ADD TABLE price_history;
  END IF;
EXCEPTION
  WHEN duplicate_object THEN
    NULL;
  WHEN OTHERS THEN
    NULL;
END $$;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_price_watches_user ON price_watches(user_id);
CREATE INDEX IF NOT EXISTS idx_price_watches_project ON price_watches(project_id);
CREATE INDEX IF NOT EXISTS idx_price_history_watch ON price_history(watch_id);
CREATE INDEX IF NOT EXISTS idx_price_alerts_sent_watch ON price_alerts_sent(watch_id);

-- Register pg_cron schedule check (hits master cron router every 6 hours)
-- Uses private settings table for authorization token
SELECT cron.schedule(
  'price-watch-check',
  '0 */6 * * *',
  $$ SELECT net.http_post(
    url := 'https://3rdmind.ai/api/cron/master',
    body := '{"trigger":"price_watch"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'Authorization','Bearer ' || (SELECT value FROM private.settings WHERE key = 'cron_secret')
    )
  ); $$
);
