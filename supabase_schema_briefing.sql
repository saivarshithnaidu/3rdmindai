-- SQL Schema for 3RDMIND Voice Briefing Agent
-- Tables: voice_briefings, briefing_configs

-- voice_briefings: stores generated briefing scripts, audio, and delivery status
CREATE TABLE IF NOT EXISTS voice_briefings (
  id              uuid PRIMARY KEY default gen_random_uuid(),
  project_id      uuid REFERENCES projects(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL,
  briefing_date   date NOT NULL,
  script          text NOT NULL,
  audio_url       text,
  duration_secs   integer,
  whatsapp_sent   boolean DEFAULT false,
  email_sent      boolean DEFAULT false,
  status          text DEFAULT 'generating' CHECK (status IN ('generating', 'ready', 'sent', 'failed')),
  created_at      timestamptz DEFAULT now()
);

-- briefing_configs: user preferences for briefing delivery
CREATE TABLE IF NOT EXISTS briefing_configs (
  id              uuid PRIMARY KEY default gen_random_uuid(),
  project_id      uuid REFERENCES projects(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL,
  delivery_time   time DEFAULT '08:00',
  timezone        text DEFAULT 'Asia/Kolkata',
  whatsapp_number text,
  email           text,
  voice_id        text DEFAULT 'rachel',
  sections        jsonb DEFAULT '[]',
  is_active       boolean DEFAULT true,
  created_at      timestamptz DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_voice_briefings_project_id ON voice_briefings(project_id);
CREATE INDEX IF NOT EXISTS idx_voice_briefings_user_id ON voice_briefings(user_id);
CREATE INDEX IF NOT EXISTS idx_voice_briefings_date ON voice_briefings(briefing_date DESC);
CREATE INDEX IF NOT EXISTS idx_voice_briefings_status ON voice_briefings(status);
CREATE INDEX IF NOT EXISTS idx_briefing_configs_project_id ON briefing_configs(project_id);
CREATE INDEX IF NOT EXISTS idx_briefing_configs_user_id ON briefing_configs(user_id);

-- Row Level Security policies
ALTER TABLE voice_briefings ENABLE ROW LEVEL SECURITY;
ALTER TABLE briefing_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own briefings"
  ON voice_briefings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own briefings"
  ON voice_briefings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own briefings"
  ON voice_briefings FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Service role full access to briefings"
  ON voice_briefings FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Users can view their own briefing configs"
  ON briefing_configs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own briefing configs"
  ON briefing_configs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own briefing configs"
  ON briefing_configs FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Service role full access to briefing configs"
  ON briefing_configs FOR ALL
  USING (auth.role() = 'service_role');

-- Enable Realtime for live updates
ALTER PUBLICATION supabase_realtime ADD TABLE voice_briefings;
ALTER TABLE voice_briefings REPLICA IDENTITY FULL;

ALTER PUBLICATION supabase_realtime ADD TABLE briefing_configs;
ALTER TABLE briefing_configs REPLICA IDENTITY FULL;
