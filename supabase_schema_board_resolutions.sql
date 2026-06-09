-- SQL Schema for 3RDMIND Board Resolutions

CREATE TABLE IF NOT EXISTS board_resolutions (
  id            uuid PRIMARY KEY default gen_random_uuid(),
  project_id    uuid REFERENCES projects(id) ON DELETE CASCADE,
  title         text NOT NULL,
  resolution    text NOT NULL,
  proposed_by   text NOT NULL,
  approved_by   jsonb default '[]',
  status        text default 'proposed' check (status in ('proposed','passed','rejected')),
  created_at    timestamptz default now()
);
