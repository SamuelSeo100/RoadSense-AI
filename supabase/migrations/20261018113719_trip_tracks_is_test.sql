-- Rows created while testing on a device (mock locations, forced alerts) are
-- marked server-side so research queries can exclude them:
--   select … from trip_tracks where not is_test
-- The app never sets it (default false).

alter table public.trip_tracks
  add column is_test boolean not null default false;

comment on column public.trip_tracks.is_test is
  'Row from device / mock-location testing: exclude from research data. Set server-side, never by the app.';
