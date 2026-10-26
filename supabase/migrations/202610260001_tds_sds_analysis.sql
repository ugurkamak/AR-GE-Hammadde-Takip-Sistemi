-- TDS/SDS document archive and analysis reports
-- Apply in Supabase SQL Editor before deploying the UI or Edge Function.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('tds-sds-private', 'tds-sds-private', false, 15728640, array['application/pdf'])
on conflict (id) do update set
  public = false,
  file_size_limit = 15728640,
  allowed_mime_types = array['application/pdf'];

create table if not exists public.tds_sds_documents (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  file_name text not null,
  document_type text not null check (document_type in ('tds','sds')),
  storage_path text not null unique,
  file_size bigint not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.tds_sds_reports (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  report_type text not null check (report_type in ('tds','sds','comparison')),
  document_ids uuid[] not null default '{}',
  report_json jsonb not null,
  model_name text not null default 'gpt-4.1-mini',
  created_at timestamptz not null default now()
);

create index if not exists tds_sds_documents_owner_created_idx
  on public.tds_sds_documents(owner_id, created_at desc);
create index if not exists tds_sds_reports_owner_created_idx
  on public.tds_sds_reports(owner_id, created_at desc);

alter table public.tds_sds_documents enable row level security;
alter table public.tds_sds_reports enable row level security;

drop policy if exists "tds_sds_documents_select_own" on public.tds_sds_documents;
create policy "tds_sds_documents_select_own" on public.tds_sds_documents
  for select to authenticated using (owner_id = auth.uid() and public.is_admin());

drop policy if exists "tds_sds_documents_insert_own" on public.tds_sds_documents;
create policy "tds_sds_documents_insert_own" on public.tds_sds_documents
  for insert to authenticated with check (owner_id = auth.uid() and public.is_admin());

drop policy if exists "tds_sds_documents_delete_own" on public.tds_sds_documents;
create policy "tds_sds_documents_delete_own" on public.tds_sds_documents
  for delete to authenticated using (owner_id = auth.uid() and public.is_admin());

drop policy if exists "tds_sds_reports_select_own" on public.tds_sds_reports;
create policy "tds_sds_reports_select_own" on public.tds_sds_reports
  for select to authenticated using (owner_id = auth.uid() and public.is_admin());

drop policy if exists "tds_sds_reports_insert_own" on public.tds_sds_reports;
create policy "tds_sds_reports_insert_own" on public.tds_sds_reports
  for insert to authenticated with check (owner_id = auth.uid() and public.is_admin());

drop policy if exists "tds_sds_reports_delete_own" on public.tds_sds_reports;
create policy "tds_sds_reports_delete_own" on public.tds_sds_reports
  for delete to authenticated using (owner_id = auth.uid() and public.is_admin());

drop policy if exists "tds_sds_private_select_own" on storage.objects;
create policy "tds_sds_private_select_own" on storage.objects
  for select to authenticated using (
    bucket_id = 'tds-sds-private'
    and (storage.foldername(name))[1] = auth.uid()::text
    and public.is_admin()
  );

drop policy if exists "tds_sds_private_insert_own" on storage.objects;
create policy "tds_sds_private_insert_own" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'tds-sds-private'
    and (storage.foldername(name))[1] = auth.uid()::text
    and public.is_admin()
  );

drop policy if exists "tds_sds_private_delete_own" on storage.objects;
create policy "tds_sds_private_delete_own" on storage.objects
  for delete to authenticated using (
    bucket_id = 'tds-sds-private'
    and (storage.foldername(name))[1] = auth.uid()::text
    and public.is_admin()
  );
