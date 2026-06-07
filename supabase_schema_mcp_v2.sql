-- Upgrade script for MCP Connector tables
-- Apply this to the Supabase Database SQL Editor

-- 1. Modify connectors table
ALTER TABLE connectors ADD COLUMN IF NOT EXISTS slug TEXT;
ALTER TABLE connectors ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE connectors ADD COLUMN IF NOT EXISTS access_token TEXT;
ALTER TABLE connectors ADD COLUMN IF NOT EXISTS refresh_token TEXT;
ALTER TABLE connectors ADD COLUMN IF NOT EXISTS token_expiry TIMESTAMPTZ;
ALTER TABLE connectors ADD COLUMN IF NOT EXISTS scopes TEXT[];
ALTER TABLE connectors ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb NOT NULL;

-- Populate slug if it is null
UPDATE connectors SET slug = LOWER(name) WHERE slug IS NULL;
ALTER TABLE connectors ALTER COLUMN slug SET NOT NULL;

-- Add user_id + slug unique constraint
ALTER TABLE connectors DROP CONSTRAINT IF EXISTS connectors_user_id_slug_key;
ALTER TABLE connectors ADD CONSTRAINT connectors_user_id_slug_key UNIQUE (user_id, slug);

-- 2. Modify tool_calls table
ALTER TABLE tool_calls ADD COLUMN IF NOT EXISTS connector_slug TEXT;

-- Drop obsolete constraints/columns (or make connector_id optional)
ALTER TABLE tool_calls ALTER COLUMN connector_id DROP NOT NULL;

-- Populate connector_slug if it is null
UPDATE tool_calls tc
SET connector_slug = c.slug
FROM connectors c
WHERE tc.connector_id = c.id AND tc.connector_slug IS NULL;
