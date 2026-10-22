# Bus ETA — spec

PMPML publishes no open real-time feed, so Routly predicts bus times itself. This
document covers the **v0 baseline** (shipped), what it logs, and the plan for the
learned model that has to beat it.

Code: `src/services/busEta.ts` (formula, constants, cache),
`src/services/google/googleBusTraffic.ts` (traffic call),
`src/features/trip/busEtaStore.ts` (UI state, top-3 selection),
`src/features/routes/components/BusEtaInfo.tsx` (bus leg row).
Live check: `src/services/transit/__manual__/busEta-manual.ts`.

## What Google gives us (audited 2026-10-22)

A real TRANSIT response (Swargate → Hinjewadi, 6 alternatives) has these fields on a
bus step, and nothing else:

```
transitDetails.stopDetails.{departureStop,arrivalStop}.{name, location.latLng}
transitDetails.stopDetails.{departureTime, arrivalTime}
transitDetails.localizedValues.{departureTime,arrivalTime}.{time.text, timeZone}
transitDetails.headsign, .stopCount
transitDetails.transitLine.{nameShort, agencies[].{name,phoneNumber,uri}, vehicle.{name.text,type,iconUri}}
staticDuration, localizedValues.{distance,staticDuration}.text, travelMode
```

**No field marks a time as real-time**, and every route's `duration` equals its
`staticDuration`. Google's bus times for Pune are timetable times, so the app never
shows "Live".

## v0 baseline

For each Google bus leg with known stops and scheduled times:

| Quantity | Definition |
|---|---|
| scheduled ride | `arrivalTime − departureTime` (minutes) |
| traffic factor | one DRIVE `computeRoutes`, `TRAFFIC_AWARE`, departure stop → arrival stop, mask `routes.duration,routes.staticDuration`: `duration / staticDuration`, clamped to [1.0, 2.5]. With a future `departureTime` when the bus leaves > 1 min from now (Google's predicted traffic), otherwise live traffic |
| predicted ride | `scheduled ride × traffic factor` |
| ride range | low = predicted, high = predicted × (1 + margin) |
| arrival at your stop | scheduled departure → + late window |
| source | `scheduled_traffic` ("Scheduled + traffic") when the factor is known; `scheduled` ("Scheduled") otherwise, with factor = 1 |

Hour band is taken from the **scheduled departure, in IST**:

| Band | Hours (IST) | Margin | Late window |
|---|---|---|---|
| peak | 08:00–10:59, 17:00–20:59 | 0.35 | 5 min |
| off_peak | 06:00–07:59, 11:00–16:59 | 0.20 | 3 min |
| night | 21:00–05:59 | 0.15 | 2 min |

All constants are in `busEtaConfig`. The margins come from the Phase 1 brief. The
night hours and the late window were chosen by hand, with no data behind them yet.
Phase 3 data should replace them.

### Cost controls

- Traffic calls only for bus legs of the **top 3** routes as ranked on screen. Lower
  routes show schedule-only times with a "Scheduled" badge.
- Each bus is requested once, however many routes share it (auto first/last-mile
  variants do).
- In-memory LRU cache keyed by (departure stop, arrival stop, 15-min bucket of the
  departure). Requests already in flight are shared. Failures are not cached.
- The calls run in parallel after the list renders. Bus rows show schedule-only times
  first and update when each call returns.
- Extra Routes API calls per search: **0–6**, usually 1–3 (two bus legs per route at
  most, shared legs counted once). The base search makes 3–4 calls, plus timetable
  access legs.

### Failure behaviour

- Traffic call fails or Google returns no route: "Scheduled", schedule-only range.
- No bus legs (or no Google key / mock mode): nothing is shown and no calls are made.

## Logging (`bus_eta_predictions`)

One row per bus leg of a route the user **started** (not every displayed route), only
with "Learn from my trips" on. Rows are written through the persistent trip-log write
queue, after the trip row, so the foreign keys hold.

Columns: `route_request_id`, `trip_id`, `leg_index`, `model` (`baseline_v0`),
`route_short_name`, `from/to_stop_name`, `from/to_lat/lng` (4 dp),
`scheduled_departure/arrival`, `traffic_factor` (null when schedule only),
`predicted_low_min` / `predicted_high_min` (in-vehicle minutes), `source`, `hour_band`,
`day_of_week` (IST, 0 = Sunday, of the scheduled departure), and `is_test`
(server-side only). RLS gives own rows only (select / insert / delete). "Clear my trip
history" deletes them.

## Phase 3 — ground truth

During navigation, log what actually happened on each bus leg of the started trip.
`trip_tracks.legs[]` already has `actual_board_time`, `actual_s` and `wait_s` per
`leg_index`. Join on `bus_eta_predictions.trip_id` + `leg_index`:

- actual boarding time vs `scheduled_departure` gives the lateness at the stop, which
  calibrates the late window
- actual ride (alight − board) vs `predicted_low/high_min`
- exclude `is_test`, abandoned trips, and legs where boarding wasn't detected

## Phase 4 — learned delay model (LightGBM)

- **Target:** actual ride minutes. A separate model handles lateness at the stop. Both
  give quantiles (e.g. p10 / p90) for the range.
- **Features:** route (short name), stop pair, hour, weekday, `traffic_factor`, rain
  flag (weather at departure), scheduled ride minutes.
- **Split:** by time. Train on earlier weeks and test on later weeks, never shuffled.
- **Metrics, against this baseline on the same test legs:**
  - MAE (minutes) of the predicted ride (baseline: `predicted_low_min`, i.e.
    schedule × factor)
  - coverage: % of actual arrivals inside the predicted range (and the range width, so
    a wider range doesn't win by default)
- **Ship rule:** lower MAE *and* coverage at least the baseline's, with no wider
  average range. Swap `estimateBusLeg` for the model and log `model` = its version.
