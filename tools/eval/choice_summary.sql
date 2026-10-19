-- Part 6: route choice in field use (Table V). Read-only; run as a role that
-- can read auth.users (SQL editor / service role), since RLS limits app users
-- to their own rows.
--
-- Edit `params` only. Window is in IST calendar days, both ends inclusive.
--
-- Exclusions:
--   * test accounts: auth.users.email matching test_email_patterns. The
--     route tables have no is_test column; the only marked test login is the
--     shared one in .env (ROUTLY_TEST_EMAIL, @example.com). Team members'
--     own accounts used for testing CANNOT be told apart from real use.
--   * is_test rows: requests whose trip has a trip_tracks row with is_test
--     (the only table with that column).
--   * requests logged before `source` existed (2026-10-17): no option has a
--     `source` key, so whether a timetable route was shown is unknown. They
--     are counted in `requests_no_source` and left out of everything else.
--
-- Choice = one per request: its latest strong action (start / book / ticket).
-- The `any_action` rows also count the weaker 'expand' (latest action of any
-- kind). The chosen option's source is route_choices.source, else the source
-- of the shown option with the same id.
-- Share p = choices of a timetable route / choices on requests that showed
-- at least one timetable route. 95% CI: Wilson score interval (z = 1.96).

with params as (
  select
    date '2026-10-17' as from_day,
    date '2026-10-19' as to_day,
    array['%@example.com']::text[] as test_email_patterns
),
excluded_users as (
  select u.id
  from auth.users u, params p
  where u.email ilike any (p.test_email_patterns)
),
test_requests as (
  select distinct t.request_id as id
  from public.trips t
  join public.trip_tracks tt on tt.trip_id = t.id
  where tt.is_test and t.request_id is not null
),
in_window as (
  select r.*
  from public.route_requests r, params p
  where (r.created_at at time zone 'Asia/Kolkata')::date between p.from_day and p.to_day
    and r.user_id not in (select id from excluded_users)
    and r.id not in (select id from test_requests)
),
requests as (
  select
    r.id,
    r.user_id,
    (r.created_at at time zone 'Asia/Kolkata')::date as day,
    exists (select 1 from jsonb_array_elements(r.options) o where o ? 'source') as has_source,
    r.options @> '[{"source": "routly_timetable"}]' as timetable_shown
  from in_window r
),
choices as (
  select
    c.request_id,
    c.action,
    c.chosen_rank,
    c.created_at,
    coalesce(
      c.source,
      (select o->>'source' from jsonb_array_elements(r.options) o
       where o->>'id' = c.chosen_route_id limit 1)
    ) as chosen_source
  from public.route_choices c
  join in_window r on r.id = c.request_id
),
latest as (
  select distinct on (kind, request_id) kind, request_id, chosen_source, chosen_rank
  from (
    select 'strong' as kind, * from choices where action in ('start', 'book', 'ticket')
    union all
    select 'any_action' as kind, * from choices
  ) x
  order by kind, request_id, created_at desc
),
shares as (
  select
    l.kind,
    count(*) as n,
    count(*) filter (where l.chosen_source = 'routly_timetable') as k,
    percentile_cont(0.5) within group (order by l.chosen_rank)
      filter (where l.chosen_source = 'routly_timetable') as median_rank_timetable
  from latest l
  join requests q on q.id = l.request_id
  where q.has_source and q.timetable_shown
  group by l.kind
),
wilson as (
  select
    kind, k, n,
    k::numeric / n as p,
    1.96::numeric as z
  from shares
)
select
  'window' as metric,
  null as kind,
  jsonb_build_object(
    'from_day', (select from_day from params),
    'to_day', (select to_day from params),
    'days_covered', (select count(distinct day) from requests where has_source),
    'distinct_users', (select count(distinct user_id) from requests where has_source),
    'requests', (select count(*) from requests where has_source),
    'requests_with_timetable_shown', (select count(*) from requests where has_source and timetable_shown),
    'requests_no_source', (select count(*) from requests where not has_source),
    'excluded_test_account_requests',
      (select count(*) from public.route_requests r, params p
       where r.user_id in (select id from excluded_users)
         and (r.created_at at time zone 'Asia/Kolkata')::date between p.from_day and p.to_day),
    'excluded_is_test_requests', (select count(*) from test_requests)
  ) as value
union all
select
  'timetable_choice_share',
  w.kind,
  jsonb_build_object(
    'k', w.k,
    'n', w.n,
    'p', round(w.p, 4),
    'wilson95_low', round((
      (w.p + w.z ^ 2 / (2 * w.n) - w.z * sqrt(w.p * (1 - w.p) / w.n + w.z ^ 2 / (4 * w.n ^ 2)))
      / (1 + w.z ^ 2 / w.n))::numeric, 4),
    'wilson95_high', round((
      (w.p + w.z ^ 2 / (2 * w.n) + w.z * sqrt(w.p * (1 - w.p) / w.n + w.z ^ 2 / (4 * w.n ^ 2)))
      / (1 + w.z ^ 2 / w.n))::numeric, 4),
    'median_rank_chosen_timetable', s.median_rank_timetable
  )
from wilson w
join shares s using (kind)
order by 1, 2;
