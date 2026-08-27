create table if not exists public.note_workspaces (
  user_id uuid primary key references auth.users(id) on delete cascade,
  state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.note_workspaces enable row level security;

drop policy if exists "Users can read their note workspace" on public.note_workspaces;
create policy "Users can read their note workspace"
on public.note_workspaces for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert their note workspace" on public.note_workspaces;
create policy "Users can insert their note workspace"
on public.note_workspaces for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update their note workspace" on public.note_workspaces;
create policy "Users can update their note workspace"
on public.note_workspaces for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

insert into storage.buckets (id, name, public)
values ('note-files', 'note-files', false)
on conflict (id) do update set public = false;

drop policy if exists "Users can read their note files" on storage.objects;
create policy "Users can read their note files"
on storage.objects for select
using (
  bucket_id = 'note-files'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Users can upload their note files" on storage.objects;
create policy "Users can upload their note files"
on storage.objects for insert
with check (
  bucket_id = 'note-files'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Users can update their note files" on storage.objects;
create policy "Users can update their note files"
on storage.objects for update
using (
  bucket_id = 'note-files'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Users can delete their note files" on storage.objects;
create policy "Users can delete their note files"
on storage.objects for delete
using (
  bucket_id = 'note-files'
  and (storage.foldername(name))[1] = auth.uid()::text
);
