# 计划日记 Supabase 云端版

纯 HTML/CSS/JS 小组件，使用 Supabase Auth + Database 做多设备同步。

## 1. Supabase 后台建表

进入 Supabase 项目后台，打开 SQL Editor，执行：

```sql
create table if not exists public.diary_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  title text not null,
  subject text default '',
  entry_date date not null,
  color text not null default 'sage',
  tags text[] not null default '{}',
  notes text[] not null default '{}',
  next_plan text default '',
  links jsonb not null default '[]'::jsonb,
  expanded boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.diary_entries enable row level security;

create policy "Users can read own diary entries"
on public.diary_entries
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can insert own diary entries"
on public.diary_entries
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can update own diary entries"
on public.diary_entries
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users can delete own diary entries"
on public.diary_entries
for delete
to authenticated
using ((select auth.uid()) = user_id);
```

## 2. 配置环境变量

在 Supabase 后台进入 Project Settings -> API，复制：

- Project URL
- anon public key

然后打开 `supabase-config.js`，填写：

```js
window.SUPABASE_CONFIG = {
  url: "你的 Project URL",
  anonKey: "你的 anon public key",
};
```

`anon public key` 可以放在前端，但一定要开启 RLS。不要把 `service_role` key 放进网页或 GitHub。

## 3. Auth 设置

进入 Authentication -> Providers，确认 Email provider 已开启。

如果你想让朋友注册后立刻登录，可以在 Authentication 设置里关闭邮箱确认；如果保留邮箱确认，朋友需要先点邮件里的确认链接。

## 4. 本地打开

直接打开 `index.html`。填好 `supabase-config.js` 后即可注册、登录、保存云端日记。

## 5. 上传 GitHub

上传这些文件：

- `index.html`
- `styles.css`
- `app.js`
- `supabase-config.js`
- `supabase-config.example.js`
- `README.md`

同一个账号在不同设备或浏览器登录后，会读取同一张 Supabase 表里的日记。
