-- SQL Schema for 3RDMIND AI Procurement Agent

-- procurement_items: tracks all software/service subscriptions in a project's tech stack
CREATE TABLE IF NOT EXISTS procurement_items (
  id              uuid PRIMARY KEY default gen_random_uuid(),
  project_id      uuid REFERENCES projects(id) ON DELETE CASCADE,
  name            text NOT NULL,
  category        text NOT NULL,
  current_provider text,
  current_price   decimal,
  billing_cycle   text check (billing_cycle in ('monthly','annual','one-time')) default 'monthly',
  currency        text default 'INR',
  renewal_date    date,
  users_count     integer,
  satisfaction    integer check (satisfaction >= 1 and satisfaction <= 5),
  status          text default 'active' check (status in ('active','evaluating','cancelled','renewal_due')),
  notes           text,
  created_at      timestamptz default now()
);

-- procurement_alternatives: AI-discovered alternatives for each procurement item
CREATE TABLE IF NOT EXISTS procurement_alternatives (
  id              uuid PRIMARY KEY default gen_random_uuid(),
  item_id         uuid REFERENCES procurement_items(id) ON DELETE CASCADE,
  provider_name   text NOT NULL,
  price           decimal NOT NULL,
  billing_cycle   text NOT NULL,
  features_match  integer check (features_match >= 0 and features_match <= 100),
  savings_amount  decimal,
  recommendation  text,
  source_url      text,
  created_at      timestamptz default now()
);

-- procurement_requests: AI research requests for new tool/service needs
CREATE TABLE IF NOT EXISTS procurement_requests (
  id              uuid PRIMARY KEY default gen_random_uuid(),
  project_id      uuid REFERENCES projects(id) ON DELETE CASCADE,
  requirement     text NOT NULL,
  budget          decimal,
  timeline        text,
  status          text default 'researching' check (status in ('researching','complete','failed')),
  top_picks       jsonb default '[]',
  recommendation  text,
  created_at      timestamptz default now()
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_procurement_items_project_id ON procurement_items(project_id);
CREATE INDEX IF NOT EXISTS idx_procurement_alternatives_item_id ON procurement_alternatives(item_id);
CREATE INDEX IF NOT EXISTS idx_procurement_requests_project_id ON procurement_requests(project_id);
CREATE INDEX IF NOT EXISTS idx_procurement_items_renewal_date ON procurement_items(renewal_date);
CREATE INDEX IF NOT EXISTS idx_procurement_items_status ON procurement_items(status);

-- Enable Row Level Security
ALTER TABLE procurement_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE procurement_alternatives ENABLE ROW LEVEL SECURITY;
ALTER TABLE procurement_requests ENABLE ROW LEVEL SECURITY;

-- RLS Policies: allow all for service role (API routes use service client)
CREATE POLICY "Allow all for service role" ON procurement_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for service role" ON procurement_alternatives FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for service role" ON procurement_requests FOR ALL USING (true) WITH CHECK (true);

-- Enable Realtime for live updates
ALTER PUBLICATION supabase_realtime ADD TABLE procurement_items;
ALTER TABLE procurement_items REPLICA IDENTITY FULL;

ALTER PUBLICATION supabase_realtime ADD TABLE procurement_alternatives;
ALTER TABLE procurement_alternatives REPLICA IDENTITY FULL;

ALTER PUBLICATION supabase_realtime ADD TABLE procurement_requests;
ALTER TABLE procurement_requests REPLICA IDENTITY FULL;
