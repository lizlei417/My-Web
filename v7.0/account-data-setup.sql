create table if not exists public.portal_user_data (
  user_id uuid not null references auth.users(id) on delete cascade,
  data_key text not null,
  value_text text not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, data_key)
);

alter table public.portal_user_data enable row level security;

drop policy if exists "portal_user_data_select_own" on public.portal_user_data;
create policy "portal_user_data_select_own"
on public.portal_user_data
for select
using (auth.uid() = user_id);

drop policy if exists "portal_user_data_insert_own" on public.portal_user_data;
create policy "portal_user_data_insert_own"
on public.portal_user_data
for insert
with check (auth.uid() = user_id);

drop policy if exists "portal_user_data_update_own" on public.portal_user_data;
create policy "portal_user_data_update_own"
on public.portal_user_data
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "portal_user_data_delete_own" on public.portal_user_data;
create policy "portal_user_data_delete_own"
on public.portal_user_data
for delete
using (auth.uid() = user_id);
