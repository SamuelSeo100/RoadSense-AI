-- Ground truth for navigated trips (research paper): predicted vs actual
-- door-to-door and per-leg times, platform waits, reroutes. One row per
-- navigated trip, inserted once when it ends (arrived / user ended), or on
-- the next app start for a trip the app was killed on (abandoned).
--
-- Only Routly's derived numbers: never raw Google API responses.
-- GPS points (track_points) only with profiles.research_consent; the insert
-- policy enforces it. Users can read, insert and delete only their own rows;
-- deleting the trip ("Clear my trip history") deletes its track.

alter table public.profiles
  add column research_consent boolean not null default false;

comment on column public.profiles.research_consent is
  'User agreed to share GPS tracks of navigated trips for research (trip_tracks.track_points).';

create table public.trip_tracks (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  route_source text not null check (route_source in ('google', 'routly_timetable')),
  started_at timestamptz not null,
  ended_at timestamptz not null check (ended_at >= started_at),
  completed boolean not null,
  end_reason text not null check (end_reason in ('arrived', 'user_ended', 'abandoned')),
  predicted_duration_s integer not null check (predicted_duration_s >= 0),
  actual_duration_s integer not null check (actual_duration_s >= 0),
  predicted_fare integer not null check (predicted_fare >= 0),
  reroute_count smallint not null default 0 check (reroute_count >= 0),
  off_route_count smallint not null default 0 check (off_route_count >= 0),
  -- [{version, leg_index, kind, mode, line, source, predicted_s, actual_s,
  --   scheduled_dep, actual_board_time, wait_s}]
  legs jsonb not null default '[]' check (jsonb_typeof(legs) = 'array'),
  -- [{s (seconds since start), lat, lng (5 dp), acc}], one per 15 s; null without consent.
  track_points jsonb check (track_points is null or jsonb_typeof(track_points) = 'array'),
  created_at timestamptz not null default now()
);

comment on table public.trip_tracks is
  'Navigated trips: predicted vs actual times per leg (ground truth). GPS only with research consent.';

create index trip_tracks_user_started_idx on public.trip_tracks (user_id, started_at desc);
create index trip_tracks_trip_idx on public.trip_tracks (trip_id);

alter table public.trip_tracks enable row level security;

create policy "Users can view own trip tracks"
  on public.trip_tracks for select to authenticated
  using ((select auth.uid()) = user_id);
-- The trip must be the user's; GPS points only with research consent.
create policy "Users can insert own trip tracks"
  on public.trip_tracks for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.trips t
      where t.id = trip_id and t.user_id = (select auth.uid())
    )
    and (
      track_points is null
      or exists (
        select 1 from public.profiles p
        where p.id = (select auth.uid()) and p.research_consent
      )
    )
  );
create policy "Users can delete own trip tracks"
  on public.trip_tracks for delete to authenticated
  using ((select auth.uid()) = user_id);
