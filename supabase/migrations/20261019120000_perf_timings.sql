-- Route-search timings (paper, Table V response time): one row per search
-- whose ranked list reached the screen.
--   t_tap      search started (destination / origin picked, swap, retry)
--   t_google   every Google response in; null when served from the app's
--              10-min route cache (no Google calls)
--   t_ranked   merged with timetable options, deduplicated and ranked
--   t_rendered first frame with the list on screen
-- cold = first search since the app started.
--
-- Users insert (and read / delete) only their own rows; no update. is_test
-- marks device-testing rows to exclude, set server-side only (as trip_tracks).

create table public.perf_timings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  cold boolean not null,
  t_tap timestamptz not null,
  t_google timestamptz,
  t_ranked timestamptz not null,
  t_rendered timestamptz not null,
  device text not null check (length(device) <= 200),
  os text not null check (length(os) <= 100),
  app_version text not null check (length(app_version) <= 100),
  is_test boolean not null default false,
  check (t_google is null or t_google >= t_tap),
  check (t_ranked >= coalesce(t_google, t_tap)),
  check (t_rendered >= t_ranked)
);

comment on table public.perf_timings is
  'Route search timings: tap → Google responses → merged + ranked → rendered. cold = first search since app start.';
comment on column public.perf_timings.t_google is
  'All Google responses received; null when the routes came from the app''s route cache.';
comment on column public.perf_timings.is_test is
  'Row to exclude from research data. Set server-side, never by the app.';

create index perf_timings_user_created_idx on public.perf_timings (user_id, created_at desc);

alter table public.perf_timings enable row level security;

create policy "Users can view own perf timings"
  on public.perf_timings for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "Users can insert own perf timings"
  on public.perf_timings for insert to authenticated
  with check ((select auth.uid()) = user_id and not is_test);
create policy "Users can delete own perf timings"
  on public.perf_timings for delete to authenticated
  using ((select auth.uid()) = user_id);
