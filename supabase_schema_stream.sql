-- SQL Schema for 3RDMIND Unified Live Streaming System

CREATE TABLE IF NOT EXISTS stream_events (
  id          uuid PRIMARY KEY default gen_random_uuid(),
  project_id  uuid REFERENCES projects(id) ON DELETE CASCADE,
  event_type  text NOT NULL,
  title       text NOT NULL,
  detail      text,
  agent_id    uuid,
  agent_name  text,
  data        jsonb default '{}',
  status      text default 'running' check (status in ('running','done','error')),
  created_at  timestamptz default now()
);

-- Postgres trigger to keep only the last 500 events per project
CREATE OR REPLACE FUNCTION cleanup_stream_events()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM stream_events
  WHERE project_id = NEW.project_id
  AND id NOT IN (
    SELECT id FROM stream_events
    WHERE project_id = NEW.project_id
    ORDER BY created_at DESC
    LIMIT 500
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER cleanup_stream_events_trigger
AFTER INSERT ON stream_events
FOR EACH ROW
EXECUTE FUNCTION cleanup_stream_events();
