# Route ranker: data contract and model spec

For: Tejas (ML). Owner on the app side: Dhanesh.
Status: draft, updated 2026-10-08. Data volume today is tiny (5 requests, 11 choices,
2 trips, all from internal testing), and "Clear my trip history" will reset it
before real collection starts. Treat everything below as the contract, not as
a dataset you can train on yet.

## 1. What gets logged

The app writes three tables in Supabase Postgres (migration:
`supabase/migrations/20261007150000_route_logging.sql`). Writes are queued on
the device and retried until they land, so rows can arrive late; always use the
row's own timestamps, never arrival order.

All times are `timestamptz` (UTC). `weekday` / `hour` are already converted to
India time (IST). Coordinates are stored rounded to 4 dp (~11 m) and are **not**
exposed through the ML views (§6).

Priority vocabulary everywhere: `fastest`, `cheapest`, `least_walking`,
`fewest_transfers`.

### route_requests: one row per ranked result shown

| column | type | notes |
|---|---|---|
| id | uuid | request id, generated on the device |
| user_id | uuid | `auth.users.id` |
| created_at | timestamptz | when the routes were shown |
| from_name, to_name | text | place names as the user saw them |
| from_lat, from_lng, to_lat, to_lng | numeric(·,4) | not in the ML views |
| priority | text | the ranking the user was looking at when results arrived |
| is_night | bool | |
| weekday | smallint | 0 = Sunday, IST |
| hour | smallint | 0–23, IST |
| options | jsonb | array of shown routes, see below |

Each `options[]` element:

| key | type | notes |
|---|---|---|
| id | text | option id, unique within the request (`bike`, `car`, `auto`, `cab`, `transit-0`, …). **Not stable across requests**: `transit-0` is "the first transit itinerary Google returned", not a fixed route. |
| name | text | display name |
| modes | text[] | leg modes in order: `walk`, `metro`, `bus`, `auto`, `cab`, `bike`, `cycle`, `train` |
| duration_min | number | door to door |
| cost_inr | number | estimated fare |
| walking_km | number | |
| transfers | int | |
| traffic | text | `Light` / `Moderate` / `Heavy` |
| rank | int | displayed rank under the request's `priority` (1 = top) |
| heuristic_rank | int | rank under the scoring heuristic for the request's `priority`. Same as `rank` today; once a learned ranker orders the cards, `rank` is the model's and this stays the heuristic's. Missing in rows logged before 2026-10-08. |
| score | object | heuristic score per priority, 0–1, **lower is better**, relative to the other options in the same request |

Example (coordinates removed, user id omitted):

```json
{
  "id": "0ff73af6-05e7-439f-9f09-0f2a176faea7",
  "created_at": "2026-10-07T17:04:12.058Z",
  "from_name": "Pimpri Colony",
  "to_name": "Pimpri",
  "priority": "fastest",
  "is_night": true,
  "weekday": 3,
  "hour": 22,
  "options": [
    { "id": "bike", "name": "Bike", "rank": 1, "modes": ["bike"], "duration_min": 7, "cost_inr": 6,
      "walking_km": 0, "transfers": 0, "traffic": "Light",
      "score": { "fastest": 0, "cheapest": 0, "least_walking": 0, "fewest_transfers": 0 } },
    { "id": "car", "name": "Car", "rank": 2, "modes": ["cab"], "duration_min": 8, "cost_inr": 19,
      "walking_km": 0, "transfers": 0, "traffic": "Light",
      "score": { "fastest": 0.038, "cheapest": 0.222, "least_walking": 0.019, "fewest_transfers": 0.019 } },
    { "id": "auto", "name": "Auto", "rank": 3, "modes": ["auto"], "duration_min": 8, "cost_inr": 55,
      "walking_km": 0, "transfers": 0, "traffic": "Light",
      "score": { "fastest": 0.11, "cheapest": 0.834, "least_walking": 0.064, "fewest_transfers": 0.064 } },
    { "id": "cab", "name": "Cab", "rank": 4, "modes": ["cab"], "duration_min": 8, "cost_inr": 126,
      "walking_km": 0, "transfers": 0, "traffic": "Light",
      "score": { "fastest": 0.112, "cheapest": 0.851, "least_walking": 0.153, "fewest_transfers": 0.153 } },
    { "id": "transit-0", "name": "Bus", "rank": 5, "modes": ["walk", "bus", "walk", "bus", "walk"],
      "duration_min": 50, "cost_inr": 10, "walking_km": 1.7, "transfers": 1, "traffic": "Light",
      "score": { "fastest": 0.645, "cheapest": 0.171, "least_walking": 0.623, "fewest_transfers": 0.413 } }
  ]
}
```

### route_choices: what the user did with an option

| column | type | notes |
|---|---|---|
| id | uuid | |
| request_id | uuid | → route_requests.id |
| user_id | uuid | |
| chosen_route_id | text | matches `options[].id` of that request |
| chosen_rank | smallint | displayed rank of that option under `priority` (below) at the moment of the action |
| heuristic_rank | smallint, nullable | heuristic rank of that option under `priority`; null before 2026-10-08 (migration `20261008120000_route_choices_heuristic_rank.sql`) |
| priority | text | ranking on screen when the user acted. May differ from the request's `priority`: users can switch priority without a new request row |
| action | text | `expand` (opened details), `start` (started the trip), `book` (opened a ride-hailing app), `ticket` (opened a transit ticket) |
| created_at | timestamptz | |

Not deduplicated: the same action can repeat (`book` three times = three taps).
Example, all for the request above:

| chosen_route_id | chosen_rank | priority | action | created_at |
|---|---|---|---|---|
| auto | 3 | fastest | expand | 17:04:22 |
| auto | 3 | fastest | expand | 17:04:23 |
| auto | 3 | fastest | start | 17:04:25 |
| auto | 3 | fastest | book | 17:04:27 |
| auto | 3 | fastest | book | 17:04:32 |
| auto | 3 | fastest | book | 17:04:47 |
| transit-0 | 5 | fastest | expand | 17:20:20 |
| transit-0 | 5 | fastest | ticket | 17:20:21 |

Note the last two rows: 16 minutes later the same user went back to the same
result and acted strongly on a *different* option. Per §2 only that last
strong action (the bus `ticket`) becomes the label.

### trips: journeys the user started (History)

| column | type | notes |
|---|---|---|
| id | uuid | |
| user_id | uuid | |
| request_id | uuid, nullable | null when "Learn from my trips" is off (then no request/choice rows exist either) |
| started_at | timestamptz | |
| from_name, to_name | text | |
| mode | text | dominant mode by minutes |
| mode_label | text | |
| duration_min, cost_inr | int | |
| cab_equivalent_inr | int, nullable | cab estimate for the same trip |
| route | jsonb | snapshot: `{id, name, legs: [{mode, label, minutes, cost_inr, approximate, polyline}]}`; polylines are not in the ML views |

Example: `{ "request_id": "0ff73af6-…", "started_at": "2026-10-07T17:04:25.575Z", "from_name": "Pimpri Colony", "to_name": "Pimpri", "mode": "auto", "mode_label": "Auto", "duration_min": 8, "cost_inr": 55, "cab_equivalent_inr": 126, "route": { "id": "auto", "name": "Auto", "legs": [{ "mode": "auto", "label": "Auto 8m", "minutes": 8, "cost_inr": 55, "approximate": false }] } }`

Every `start` choice has a matching trip; trips add nothing to the labels but
are the cleanest record of "the user actually went".

**Consent.** Requests and choices are only logged while the user's "Learn from
my trips" setting is on. Users can delete all three tables' rows ("Clear my
trip history"); rows are deleted, not flagged, so your training snapshot must
be re-pulled rather than accumulated.

## 2. Labels

The unit is a **query group = one request**, with exactly one positive:

- **Positive (relevance 2):** the option of the request's **last strong
  action** (`start`, `book` or `ticket`, latest `created_at`). The group's
  priority is that action's `priority`.
- **Earlier strong actions are dropped.** If the user booked an auto and later
  bought a bus ticket in the same request, the bus is the label; the auto is
  removed from the group (neither positive nor negative), since it was
  considered seriously and then abandoned.
- **Weak positive (relevance 1):** an option with an `expand` but no strong
  action. Optional; train with and without it.
- **Negative (relevance 0):** every other option of the request.
- **Requests with no strong action** are not training groups (browsing only).
- **Different priority isn't a negative.** Options are ranked and judged only
  under the group's priority (the last strong action's). Expands made while
  the user was looking at another priority don't make an option a weak
  positive either; drop them.
- Ranks inside a group: use `route_choices.heuristic_rank` for the chosen
  option, and for the others sort `options` by `score.<group priority>`
  ascending. `options[].heuristic_rank` is only right when the group's
  priority equals the request's.

```sql
-- One labelled row per (request, option). Positive = last strong action.
with last_strong as (
  select distinct on (request_id)
    request_id, chosen_route_id, priority, heuristic_rank, created_at
  from route_choices
  where action in ('start', 'book', 'ticket')
  order by request_id, created_at desc
),
earlier_strong as (
  select distinct c.request_id, c.chosen_route_id
  from route_choices c
  join last_strong l using (request_id)
  where c.action in ('start', 'book', 'ticket')
    and c.chosen_route_id <> l.chosen_route_id
),
expanded as (
  select distinct c.request_id, c.chosen_route_id
  from route_choices c
  join last_strong l using (request_id)
  where c.action = 'expand' and c.priority = l.priority
)
select r.id as request_id, l.priority as group_priority, o->>'id' as option_id,
       case when o->>'id' = l.chosen_route_id then 2
            when e.chosen_route_id is not null then 1
            else 0 end as relevance,
       o as option, r.hour, r.weekday, r.is_night
from route_requests r
join last_strong l on l.request_id = r.id
cross join lateral jsonb_array_elements(r.options) o
left join earlier_strong es on es.request_id = r.id and es.chosen_route_id = o->>'id'
left join expanded e on e.request_id = r.id and e.chosen_route_id = o->>'id'
where es.chosen_route_id is null;
```

## 3. Features

Per option (all in `options[]`):

- `duration_min`, `cost_inr`, `walking_km`, `transfers`
- `traffic` (ordinal: Light < Moderate < Heavy)
- mode sequence: `modes[]` → counts per mode, first/last mode, dominant mode,
  number of legs, has_walk, is_transit
- heuristic rank under the group's priority, and all four `score.*` values
- within-request relative features (option minus request min, or z-score):
  duration, cost, walking. The heuristic scores are already relative, the raw
  numbers are not.

Per context:

- `hour`, `weekday`, `is_night` (IST)
- `priority` of the group (one-hot)
- user history, computed **only from rows before the request's `created_at`**
  (no leakage): number of past starts, share of past starts per dominant mode,
  median accepted cost and walking_km, share of starts that were the
  heuristic's rank 1
- no coordinates in v1. Place names are available but sparse; distance can be
  approximated from the car/cab option's duration if needed.

## 4. Baseline to beat

The heuristic's rank-1 hit rate on the labels: of the requests with a strong
action, how often was the **last** strong action's option ranked 1 by the
heuristic under the priority the user was looking at
(`route_choices.heuristic_rank`).

```sql
-- Heuristic rank-1 hit rate (and MRR) on the last strong action per request.
with last_strong as (
  select distinct on (request_id) request_id, priority, heuristic_rank
  from route_choices
  where action in ('start', 'book', 'ticket')
  order by request_id, created_at desc
)
select
  count(*)                                             as labelled_requests,
  count(*) filter (where heuristic_rank = 1)           as rank1_hits,
  round(avg((heuristic_rank = 1)::int)::numeric, 3)    as rank1_hit_rate,
  round(avg(1.0 / heuristic_rank)::numeric, 3)         as mrr
from last_strong
where heuristic_rank is not null;   -- rows before 2026-10-08 have none
```

Report the model on the same population (held out by time, not randomly)
with hit@1 and MRR, plus a per-priority breakdown (`group by priority`).

## 5. Suggested model

- **Ranker:** LightGBM `lambdarank` (LambdaMART), one query group per §2,
  relevance 0/1/2, optimise NDCG@1 / NDCG@3. Groups are small (3–8 options),
  so pairwise and listwise behave similarly; LambdaMART is the default.
- **Split:** by time (train on older weeks, validate on the latest), and also
  report a split that holds out whole users, to see how it does for new users.
- **Per-user cold start:** for users with fewer than N past starts (start with
  N = 5, tune it), the app uses the heuristic ranking. The serving side
  returns the heuristic order for them (`ranker: "heuristic"` in the
  response, §6), so the app doesn't need to know N.
- A global model without user-history features is a reasonable middle step
  before personalisation, and the right thing to compare against first.

## 6. Serving contract

The app calls the backend (`EXPO_PUBLIC_API_URL`) once per ranked result.

```
POST /rank
Authorization: Bearer <Supabase access token>     -- backend derives user_id from it
Content-Type: application/json
```

Request (`heuristic_rank` = `options[].heuristic_rank` as logged):

```json
{
  "request_id": "0ff73af6-05e7-439f-9f09-0f2a176faea7",
  "context": { "priority": "fastest", "hour": 22, "weekday": 3, "is_night": true },
  "options": [
    { "id": "bike", "modes": ["bike"], "duration_min": 7, "cost_inr": 6, "walking_km": 0,
      "transfers": 0, "traffic": "Light", "heuristic_rank": 1,
      "score": { "fastest": 0, "cheapest": 0, "least_walking": 0, "fewest_transfers": 0 } }
  ]
}
```

The options carry the same fields as `route_requests.options`, so serving
features match training features.

Response `200`:

```json
{
  "model_version": "lgbm-2026-11-01",
  "ranker": "model",
  "scores": { "bike": 1.42, "car": 0.37, "auto": 0.12, "cab": -0.8, "transit-0": -1.1 }
}
```

- `scores`: one number per option id, **higher = better**. The app sorts by
  it; ties keep heuristic order.
- `ranker`: `"model"` or `"heuristic"` (cold-start user; scores then just
  reproduce the heuristic order).
- **Budget: 300 ms** end to end, measured on the device. On timeout, any
  non-200, or a response missing any option id, the app uses the heuristic
  ranking and does not retry for that request.
- The endpoint must not write anything; logging stays in the app's tables.

App-side follow-up (not done yet): record `model_version` / `ranker` on
`route_requests`, so offline evaluation can separate model-ranked from
heuristic-ranked impressions. The heuristic rank is already logged separately
(`heuristic_rank` in options and choices), so it survives the switch.

## 7. Read-only database access

Not applied. Run it as `postgres` in the SQL editor (or as a migration) when
we're ready. It creates a non-exposed `ml` schema with views that leave out
coordinates and polylines and replace `user_id` with a stable pseudonym, plus
a login role that can read only those views.

```sql
-- Pseudonymous user key: stable per user, not reversible without the salt.
-- Replace the salt; keep it out of git.
create schema if not exists ml;
revoke all on schema ml from public, anon, authenticated;

create or replace view ml.route_requests as
select id, md5('<salt>' || user_id::text) as user_key, created_at,
       from_name, to_name, priority, is_night, weekday, hour, options
from public.route_requests;

create or replace view ml.route_choices as
select id, request_id, md5('<salt>' || user_id::text) as user_key,
       chosen_route_id, chosen_rank, heuristic_rank, priority, action, created_at
from public.route_choices;

create or replace view ml.trips as
select id, request_id, md5('<salt>' || user_id::text) as user_key, started_at,
       from_name, to_name, mode, mode_label, duration_min, cost_inr, cab_equivalent_inr,
       jsonb_build_object(
         'id', route->'id', 'name', route->'name',
         'legs', coalesce((select jsonb_agg(l - 'polyline') from jsonb_array_elements(route->'legs') l), '[]'::jsonb)
       ) as route
from public.trips;

-- The views run with their owner's (postgres) rights, which is what lets them
-- read across users despite RLS. Don't add this schema to the API's exposed
-- schemas.
create role ml_reader login password '<strong password>'
  noinherit nocreatedb nocreaterole;
alter role ml_reader set default_transaction_read_only = on;
alter role ml_reader set statement_timeout = '60s';
grant usage on schema ml to ml_reader;
grant select on ml.route_requests, ml.route_choices, ml.trips to ml_reader;
```

Connect through the Supabase pooler (Project Settings → Database →
Connection string), user `ml_reader.<project-ref>`. To revoke:
`drop owned by ml_reader; drop role ml_reader;`.
