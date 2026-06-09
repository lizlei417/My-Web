create table if not exists public.user_music (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  artist text not null default '本地音乐',
  storage_path text not null,
  created_at timestamptz not null default now()
);

alter table public.user_music enable row level security;

drop policy if exists "Users can read their music" on public.user_music;
create policy "Users can read their music"
on public.user_music for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert their music" on public.user_music;
create policy "Users can insert their music"
on public.user_music for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can delete their music" on public.user_music;
create policy "Users can delete their music"
on public.user_music for delete
using (auth.uid() = user_id);

insert into storage.buckets (id, name, public)
values ('portal-music', 'portal-music', false)
on conflict (id) do update set public = false;

drop policy if exists "Users can read their music files" on storage.objects;
create policy "Users can read their music files"
on storage.objects for select
using (
  bucket_id = 'portal-music'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Users can upload their music files" on storage.objects;
create policy "Users can upload their music files"
on storage.objects for insert
with check (
  bucket_id = 'portal-music'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Users can delete their music files" on storage.objects;
create policy "Users can delete their music files"
on storage.objects for delete
using (
  bucket_id = 'portal-music'
  and (storage.foldername(name))[1] = auth.uid()::text
);
