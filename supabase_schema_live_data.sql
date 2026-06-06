-- Create canvases table
CREATE TABLE IF NOT EXISTS canvases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  columns JSONB NOT NULL,
  rows_target INTEGER DEFAULT 20 NOT NULL,
  rows_done INTEGER DEFAULT 0 NOT NULL,
  mode TEXT CHECK (mode IN ('search','enrich')) NOT NULL,
  status TEXT DEFAULT 'building' CHECK (status IN ('building','done','error')) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Create canvas_rows table
CREATE TABLE IF NOT EXISTS canvas_rows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  canvas_id UUID REFERENCES canvases(id) ON DELETE CASCADE NOT NULL,
  row_index INTEGER NOT NULL,
  data JSONB NOT NULL,
  sources JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Create artifacts table
CREATE TABLE IF NOT EXISTS artifacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
  type TEXT CHECK (type IN ('app','document','chart','tool','game','code')) NOT NULL,
  title TEXT NOT NULL,
  code TEXT NOT NULL,
  version INTEGER DEFAULT 1 NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Enable Row Level Security (RLS)
ALTER TABLE canvases ENABLE ROW LEVEL SECURITY;
ALTER TABLE canvas_rows ENABLE ROW LEVEL SECURITY;
ALTER TABLE artifacts ENABLE ROW LEVEL SECURITY;

-- RLS Policies (Allow read/write access for demo guest & service operations)
DROP POLICY IF EXISTS "Allow public read/write canvases" ON canvases;
CREATE POLICY "Allow public read/write canvases" ON canvases FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public read/write canvas_rows" ON canvas_rows;
CREATE POLICY "Allow public read/write canvas_rows" ON canvas_rows FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public read/write artifacts" ON artifacts;
CREATE POLICY "Allow public read/write artifacts" ON artifacts FOR ALL USING (true) WITH CHECK (true);

-- Enable Supabase Realtime for canvases and canvas_rows tables
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE canvases;
    ALTER PUBLICATION supabase_realtime ADD TABLE canvas_rows;
  END IF;
EXCEPTION
  WHEN duplicate_object THEN
    NULL;
  WHEN OTHERS THEN
    NULL;
END $$;

-- Atomic counter increment for canvas rows done
CREATE OR REPLACE FUNCTION increment_canvas_rows_done(canvas_id_param UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE canvases
  SET rows_done = rows_done + 1
  WHERE id = canvas_id_param;
END;
$$ LANGUAGE plpgsql;

