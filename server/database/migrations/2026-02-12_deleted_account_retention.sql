-- Deleted account retention ledger
-- Run this in Supabase SQL Editor before enabling retention-based account deletion.

create table if not exists public.deleted_account_retention (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  supabase_id text not null,
  email text,
  deleted_at timestamptz not null default now(),
  retention_ends_at timestamptz not null,
  quarantined_file_paths text[] not null default '{}'::text[],
  metadata jsonb not null default '{}'::jsonb,
  purged_at timestamptz
);

create index if not exists idx_deleted_account_retention_retention_ends_at
  on public.deleted_account_retention (retention_ends_at)
  where purged_at is null;

create index if not exists idx_deleted_account_retention_deleted_at
  on public.deleted_account_retention (deleted_at desc);
