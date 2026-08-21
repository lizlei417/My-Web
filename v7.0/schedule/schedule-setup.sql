-- My-Web v7.0 / 日程纪要
-- 在 Supabase SQL Editor 中以项目拥有者身份执行。

create extension if not exists pgcrypto;

create table if not exists public.schedule_series (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 80),
  note text not null default '',
  color text not null default 'blue' check (color in ('pink', 'orange', 'yellow', 'mint', 'blue', 'lavender', 'purple')),
  start_date date not null,
  start_time time not null,
  end_time time not null,
  recurrence_type text not null default 'none' check (recurrence_type in ('none', 'daily', 'weekly', 'biweekly', 'monthly')),
  recurrence_weekday smallint check (recurrence_weekday between 0 and 6),
  recurrence_monthday smallint check (recurrence_monthday between 1 and 31),
  recurrence_until date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint schedule_series_positive_duration check (end_time > start_time),
  constraint schedule_series_recurrence_shape check (
    (recurrence_type in ('weekly', 'biweekly') and recurrence_weekday is not null and recurrence_monthday is null)
    or (recurrence_type = 'monthly' and recurrence_monthday is not null and recurrence_weekday is null)
    or (recurrence_type in ('none', 'daily') and recurrence_weekday is null and recurrence_monthday is null)
  )
);

create table if not exists public.schedule_occurrence_overrides (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  series_id uuid not null references public.schedule_series(id) on delete cascade,
  occurrence_date date not null,
  action text not null check (action in ('deleted', 'modified')),
  override_title text,
  override_note text,
  override_color text check (override_color is null or override_color in ('pink', 'orange', 'yellow', 'mint', 'blue', 'lavender', 'purple')),
  override_start_time time,
  override_end_time time,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint schedule_override_unique_occurrence unique (series_id, occurrence_date),
  constraint schedule_override_positive_duration check (
    override_start_time is null or override_end_time is null or override_end_time > override_start_time
  )
);

create table if not exists public.schedule_deadlines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  due_date date not null,
  title text not null check (char_length(trim(title)) between 1 and 100),
  note text not null default '',
  completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists schedule_series_user_start_idx
  on public.schedule_series (user_id, start_date);
create index if not exists schedule_series_user_until_idx
  on public.schedule_series (user_id, recurrence_until);
create index if not exists schedule_overrides_user_date_idx
  on public.schedule_occurrence_overrides (user_id, occurrence_date);
create index if not exists schedule_deadlines_user_date_idx
  on public.schedule_deadlines (user_id, due_date);

create or replace function public.set_schedule_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists schedule_series_set_updated_at on public.schedule_series;
create trigger schedule_series_set_updated_at
before update on public.schedule_series
for each row execute function public.set_schedule_updated_at();

drop trigger if exists schedule_overrides_set_updated_at on public.schedule_occurrence_overrides;
create trigger schedule_overrides_set_updated_at
before update on public.schedule_occurrence_overrides
for each row execute function public.set_schedule_updated_at();

drop trigger if exists schedule_deadlines_set_updated_at on public.schedule_deadlines;
create trigger schedule_deadlines_set_updated_at
before update on public.schedule_deadlines
for each row execute function public.set_schedule_updated_at();

alter table public.schedule_series enable row level security;
alter table public.schedule_occurrence_overrides enable row level security;
alter table public.schedule_deadlines enable row level security;

drop policy if exists "schedule_series_select_own" on public.schedule_series;
drop policy if exists "schedule_series_insert_own" on public.schedule_series;
drop policy if exists "schedule_series_update_own" on public.schedule_series;
drop policy if exists "schedule_series_delete_own" on public.schedule_series;
create policy "schedule_series_select_own" on public.schedule_series for select using (auth.uid() = user_id);
create policy "schedule_series_insert_own" on public.schedule_series for insert with check (auth.uid() = user_id);
create policy "schedule_series_update_own" on public.schedule_series for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "schedule_series_delete_own" on public.schedule_series for delete using (auth.uid() = user_id);

drop policy if exists "schedule_overrides_select_own" on public.schedule_occurrence_overrides;
drop policy if exists "schedule_overrides_insert_own" on public.schedule_occurrence_overrides;
drop policy if exists "schedule_overrides_update_own" on public.schedule_occurrence_overrides;
drop policy if exists "schedule_overrides_delete_own" on public.schedule_occurrence_overrides;
create policy "schedule_overrides_select_own" on public.schedule_occurrence_overrides for select using (auth.uid() = user_id);
create policy "schedule_overrides_insert_own" on public.schedule_occurrence_overrides for insert with check (
  auth.uid() = user_id and exists (
    select 1 from public.schedule_series s where s.id = series_id and s.user_id = auth.uid()
  )
);
create policy "schedule_overrides_update_own" on public.schedule_occurrence_overrides for update using (auth.uid() = user_id) with check (
  auth.uid() = user_id and exists (
    select 1 from public.schedule_series s where s.id = series_id and s.user_id = auth.uid()
  )
);
create policy "schedule_overrides_delete_own" on public.schedule_occurrence_overrides for delete using (auth.uid() = user_id);

drop policy if exists "schedule_deadlines_select_own" on public.schedule_deadlines;
drop policy if exists "schedule_deadlines_insert_own" on public.schedule_deadlines;
drop policy if exists "schedule_deadlines_update_own" on public.schedule_deadlines;
drop policy if exists "schedule_deadlines_delete_own" on public.schedule_deadlines;
create policy "schedule_deadlines_select_own" on public.schedule_deadlines for select using (auth.uid() = user_id);
create policy "schedule_deadlines_insert_own" on public.schedule_deadlines for insert with check (auth.uid() = user_id);
create policy "schedule_deadlines_update_own" on public.schedule_deadlines for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "schedule_deadlines_delete_own" on public.schedule_deadlines for delete using (auth.uid() = user_id);

grant select, insert, update, delete on public.schedule_series to authenticated;
grant select, insert, update, delete on public.schedule_occurrence_overrides to authenticated;
grant select, insert, update, delete on public.schedule_deadlines to authenticated;

