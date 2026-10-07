-- Route requests, choices and trips: the user's real History, and labelled
-- examples for the ML route ranker (ranked options shown → the one picked).
--
-- Privacy: coordinates are numeric(…, 4) (~11 m), so the database itself
-- rounds whatever the client sends. Users can read, insert and delete only
-- their own rows ("Clear my trip history"); there is no update.

-- ---------------------------------------------------------------------------
-- route_requests: one row per ranked result the user was shown.
create table public.route_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  from_name text not null default '' check (length(from_name) <= 200),
  from_lat numeric(6, 4) not null check (from_lat between -90 and 90),
  from_lng numeric(7, 4) not null check (from_lng between -180 and 180),
  to_name text not null default '' check (length(to_name) <= 200),
  to_lat numeric(6, 4) not null check (to_lat between -90 and 90),
  to_lng numeric(7, 4) not null check (to_lng between -180 and 180),
  -- Same vocabulary as profiles.priority.
  priority text not null
    check (priority in ('cheapest', 'fastest', 'least_walking', 'fewest_transfers')),
  is_night boolean not null,
  -- Local (IST) time features: 0 = Sunday.
  weekday smallint not null check (weekday between 0 and 6),
  hour smallint not null check (hour between 0 and 23),
  -- Shown routes, compact: [{id, name, modes[], duration_min, cost_inr,
  -- walking_km, transfers, traffic, rank, score{priority: n}}].
  options jsonb not null default '[]' check (jsonb_typeof(options) = 'array')
);

comment on table public.route_requests is
  'Ranked route options shown to a user (ML ranker features). Coordinates rounded to 4 dp.';

-- ---------------------------------------------------------------------------
-- route_choices: what the user did with an option. Not deduplicated (the
-- trainer does that); 'expand' is a weak signal, the rest strong.
create table public.route_choices (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.route_requests (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  chosen_route_id text not null check (length(chosen_route_id) <= 64),
  chosen_rank smallint not null check (chosen_rank >= 1),
  -- Ranking the user was looking at when choosing (it can change after the
  -- request without a new request row).
  priority text
    check (priority in ('cheapest', 'fastest', 'least_walking', 'fewest_transfers')),
  action text not null check (action in ('start', 'book', 'ticket', 'expand')),
  created_at timestamptz not null default now()
);

comment on table public.route_choices is
  'User actions on a shown route option: expand (weak), book / ticket / start (strong).';

-- ---------------------------------------------------------------------------
-- trips: started journeys (History). `route` is a snapshot: legs with mode,
-- label, minutes, cost and one encoded polyline string per leg.
create table public.trips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- Null when "Learn from my trips" is off (no request was logged).
  request_id uuid references public.route_requests (id) on delete set null,
  route jsonb not null check (jsonb_typeof(route) = 'object'),
  started_at timestamptz not null default now(),
  from_name text not null check (length(from_name) <= 200),
  to_name text not null check (length(to_name) <= 200),
  -- Dominant mode by minutes.
  mode text not null
    check (mode in ('walk', 'metro', 'bus', 'auto', 'cab', 'bike', 'cycle', 'train')),
  mode_label text not null check (length(mode_label) <= 100),
  duration_min integer not null check (duration_min >= 0),
  cost_inr integer not null check (cost_inr >= 0),
  -- Cab estimate for the same trip, for "saved vs cab"; null if unknown.
  cab_equivalent_inr integer check (cab_equivalent_inr >= 0)
);

comment on table public.trips is 'Journeys the user started (History, monthly stats).';

-- ---------------------------------------------------------------------------
-- Indexes: per-user recency, plus the foreign keys.
create index route_requests_user_created_idx on public.route_requests (user_id, created_at desc);
create index route_choices_user_created_idx on public.route_choices (user_id, created_at desc);
create index route_choices_request_idx on public.route_choices (request_id);
create index trips_user_started_idx on public.trips (user_id, started_at desc);
create index trips_request_idx on public.trips (request_id);

-- ---------------------------------------------------------------------------
-- RLS: own rows only. select / insert / delete; no update.
alter table public.route_requests enable row level security;
alter table public.route_choices enable row level security;
alter table public.trips enable row level security;

create policy "Users can view own route requests"
  on public.route_requests for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "Users can insert own route requests"
  on public.route_requests for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "Users can delete own route requests"
  on public.route_requests for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can view own route choices"
  on public.route_choices for select to authenticated
  using ((select auth.uid()) = user_id);
-- A choice may only point at the user's own request.
create policy "Users can insert own route choices"
  on public.route_choices for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.route_requests r
      where r.id = request_id and r.user_id = (select auth.uid())
    )
  );
create policy "Users can delete own route choices"
  on public.route_choices for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can view own trips"
  on public.trips for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "Users can insert own trips"
  on public.trips for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and (
      request_id is null
      or exists (
        select 1 from public.route_requests r
        where r.id = request_id and r.user_id = (select auth.uid())
      )
    )
  );
create policy "Users can delete own trips"
  on public.trips for delete to authenticated
  using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- This month's History stats (IST calendar month), computed in SQL.
-- Security invoker: RLS on trips applies, so it only ever sees the caller's rows.
create function public.trip_stats_this_month()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with mine as (
    select mode, cost_inr, cab_equivalent_inr
    from public.trips
    where user_id = (select auth.uid())
      and started_at >= (date_trunc('month', now() at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata')
  ),
  total as (select count(*) as n from mine),
  mix as (
    select mode, round(100.0 * count(*) / (select n from total))::int as percent
    from mine
    group by mode
  )
  select jsonb_build_object(
    'trips', (select n from total),
    'spent_inr', coalesce((select sum(cost_inr) from mine), 0),
    'saved_vs_cab_inr',
      coalesce((select sum(greatest(coalesce(cab_equivalent_inr, cost_inr) - cost_inr, 0)) from mine), 0),
    'mode_mix',
      coalesce((select jsonb_agg(jsonb_build_object('mode', mode, 'percent', percent) order by percent desc) from mix), '[]'::jsonb)
  );
$$;

revoke execute on function public.trip_stats_this_month() from public, anon;
grant execute on function public.trip_stats_this_month() to authenticated;
