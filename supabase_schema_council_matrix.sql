-- Create council_matrix table
CREATE TABLE IF NOT EXISTS council_matrix (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  manager_id UUID REFERENCES agents(id) ON DELETE CASCADE NOT NULL,
  claims JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Enable Row Level Security (RLS)
ALTER TABLE council_matrix ENABLE ROW LEVEL SECURITY;

-- Allow public read/write access for demo/testing
CREATE POLICY "Allow public read/write council_matrix" ON council_matrix FOR ALL USING (true) WITH CHECK (true);

-- Enable Supabase Realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE council_matrix;
