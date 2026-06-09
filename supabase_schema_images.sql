-- =============================================
-- 3RDMIND: Generated Images Schema
-- =============================================

-- Generated images table
create table if not exists generated_images (
  id              uuid primary key default gen_random_uuid(),
  project_id      uuid references projects(id),
  agent_id        uuid,
  message_id      uuid,
  prompt          text not null,
  negative_prompt text,
  model           text not null default 'flux-pro',
  width           integer default 1024,
  height          integer default 1024,
  image_url       text not null,
  storage_path    text,
  task_context    text,
  created_at      timestamptz default now()
);

-- Indexes
create index if not exists idx_generated_images_project on generated_images(project_id);
create index if not exists idx_generated_images_agent on generated_images(agent_id);
create index if not exists idx_generated_images_message on generated_images(message_id);
create index if not exists idx_generated_images_created on generated_images(created_at desc);

-- Enable RLS
alter table generated_images enable row level security;

-- RLS Policies
create policy "Service role full access on generated_images"
  on generated_images for all
  using (true)
  with check (true);

-- Enable Realtime
alter publication supabase_realtime add table generated_images;
