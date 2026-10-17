-- Where each route's timing came from: 'google' (Routes API) or
-- 'routly_timetable' (our static Pune Metro / Pune–Lonavala local timetables).
-- Needed to compare how riders pick scheduled vs Google options (ranker study).
--
-- route_requests.options[] and trips.route gain `source` the same way
-- (jsonb, no schema change); trips.route.legs[] also gain `realtime`.
-- Null for rows logged before this column existed.

alter table public.route_choices
  add column source text check (source in ('google', 'routly_timetable'));

comment on column public.route_choices.source is
  'Source of the chosen option: google (Routes API) or routly_timetable (static metro / local train timetable).';
