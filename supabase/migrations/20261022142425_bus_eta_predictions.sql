-- Bus ETA predictions (docs/bus-eta-spec.md): what the app told the user for
-- each bus leg of a route they started. The baseline (model 'baseline_v0':
-- Google's schedule × road traffic factor) that a learned delay model must
-- beat, once Phase 3 logs actual boarding / alighting times to compare with.
--
-- Only routes the user started, never every displayed route. Only with
-- "Learn from my trips" on (same as route_requests). Coordinates are
-- numeric(…, 4) (~11 m), like the other logging tables.
--
-- predicted_low_min / predicted_high_min are in-vehicle minutes:
--   low  = scheduled ride × traffic_factor (1 when schedule only)
--   high = low × (1 + margin(hour_band))
-- source: 'scheduled_traffic' (schedule × live road traffic between the stops)
-- or 'scheduled' (schedule only: traffic call failed or wasn't made). Never
-- 'live': no real-time bus data exists for PMPML.
-- hour_band and day_of_week (IST, 0 = Sunday) are of the scheduled departure.
--
-- Users can read, insert and delete only their own rows; no update. is_test
-- marks device-testing rows to exclude, set server-side only.

create table public.bus_eta_predictions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  route_request_id uuid references public.route_requests (id) on delete cascade,
  -- The started trip and the bus leg's position in its route (joins Phase 3 ground truth).
  trip_id uuid references public.trips (id) on delete set null,
  leg_index smallint check (leg_index >= 0),
  created_at timestamptz not null default now(),
  model text not null check (length(model) <= 50),
  route_short_name text check (length(route_short_name) <= 50),
  from_stop_name text not null check (length(from_stop_name) <= 200),
  from_lat numeric(6, 4) not null check (from_lat between -90 and 90),
  from_lng numeric(7, 4) not null check (from_lng between -180 and 180),
  to_stop_name text not null check (length(to_stop_name) <= 200),
  to_lat numeric(6, 4) not null check (to_lat between -90 and 90),
  to_lng numeric(7, 4) not null check (to_lng between -180 and 180),
  scheduled_departure timestamptz not null,
  scheduled_arrival timestamptz not null,
  traffic_factor numeric(4, 3) check (traffic_factor between 1 and 2.5),
  predicted_low_min numeric(6, 1) not null check (predicted_low_min >= 0),
  predicted_high_min numeric(6, 1) not null,
  source text not null check (source in ('scheduled', 'scheduled_traffic')),
  hour_band text not null check (hour_band in ('peak', 'off_peak', 'night')),
  day_of_week smallint not null check (day_of_week between 0 and 6),
  is_test boolean not null default false,
  check (scheduled_arrival > scheduled_departure),
  check (predicted_high_min >= predicted_low_min),
  check ((source = 'scheduled') = (traffic_factor is null))
);

comment on table public.bus_eta_predictions is
  'Bus leg ETAs shown for started routes (baseline for the bus delay model). Coordinates rounded to 4 dp.';
comment on column public.bus_eta_predictions.predicted_low_min is
  'In-vehicle minutes, low end: scheduled ride × traffic_factor.';
comment on column public.bus_eta_predictions.predicted_high_min is
  'In-vehicle minutes, high end: low × (1 + hour-band margin).';
comment on column public.bus_eta_predictions.is_test is
  'Row to exclude from research data. Set server-side, never by the app.';

create index bus_eta_predictions_user_created_idx
  on public.bus_eta_predictions (user_id, created_at desc);
create index bus_eta_predictions_request_idx on public.bus_eta_predictions (route_request_id);
create index bus_eta_predictions_trip_idx on public.bus_eta_predictions (trip_id);

alter table public.bus_eta_predictions enable row level security;

create policy "Users can view own bus eta predictions"
  on public.bus_eta_predictions for select to authenticated
  using ((select auth.uid()) = user_id);
-- The request and trip, when set, must be the user's.
create policy "Users can insert own bus eta predictions"
  on public.bus_eta_predictions for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and not is_test
    and (
      route_request_id is null
      or exists (
        select 1 from public.route_requests r
        where r.id = route_request_id and r.user_id = (select auth.uid())
      )
    )
    and (
      trip_id is null
      or exists (
        select 1 from public.trips t
        where t.id = trip_id and t.user_id = (select auth.uid())
      )
    )
  );
create policy "Users can delete own bus eta predictions"
  on public.bus_eta_predictions for delete to authenticated
  using ((select auth.uid()) = user_id);
