-- Writer's Oatmeal: cloud storage setup.
-- Paste this whole file into Supabase → SQL Editor → New query, then press Run.
-- It's safe to run more than once.

-- 1. One row per story (plus one for library settings), private to each user.
create table if not exists public.docs (
  user_id    uuid    not null default auth.uid() references auth.users on delete cascade,
  id         text    not null,
  data       jsonb,
  deleted    boolean not null default false,
  updated_at bigint  not null,
  primary key (user_id, id)
);

alter table public.docs enable row level security;

drop policy if exists "Only you can see and change your stories" on public.docs;
create policy "Only you can see and change your stories" on public.docs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 2. A private bucket for images (covers, portraits, maps).
insert into storage.buckets (id, name, public)
values ('images', 'images', false)
on conflict (id) do nothing;

drop policy if exists "Only you can see your images" on storage.objects;
create policy "Only you can see your images" on storage.objects
  for select using (bucket_id = 'images' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Only you can add your images" on storage.objects;
create policy "Only you can add your images" on storage.objects
  for insert with check (bucket_id = 'images' and (storage.foldername(name))[1] = auth.uid()::text);
