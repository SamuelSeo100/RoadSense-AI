import type { SupabaseClient } from '@supabase/supabase-js';

import { decodePolyline } from '../google/polyline';
import type { HistoryService, Leg, Mode, MonthlyStats, Trip } from '../types';

const MODES: readonly Mode[] = ['walk', 'metro', 'bus', 'auto', 'cab', 'bike', 'cycle', 'train'];
const isMode = (v: unknown): v is Mode => typeof v === 'string' && MODES.includes(v as Mode);

/** How many recent trips History shows. */
const TRIP_LIMIT = 50;

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const WEEKDAYS = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

/** A date shifted to India time; read it with the getUTC* methods. */
const ist = (d: Date) => new Date(d.getTime() + IST_OFFSET_MS);
const istDayNumber = (d: Date) => Math.floor(ist(d).getTime() / DAY_MS);

/** "TODAY" / "YESTERDAY" / "SATURDAY" (within a week) / "12 SEP" (older), in IST. */
export function dayLabel(at: Date, now = new Date()): string {
  const diff = istDayNumber(now) - istDayNumber(at);
  const d = ist(at);
  if (diff <= 0) return 'TODAY';
  if (diff === 1) return 'YESTERDAY';
  if (diff < 7) return WEEKDAYS[d.getUTCDay()] ?? '';
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()] ?? ''}`;
}

/** "9:12 AM" in IST. */
export function istTime(at: Date): string {
  const d = ist(at);
  const h = d.getUTCHours();
  const m = String(d.getUTCMinutes()).padStart(2, '0');
  return `${h % 12 || 12}:${m} ${h < 12 ? 'AM' : 'PM'}`;
}

interface TripRow {
  id: string;
  started_at: string;
  from_name: string;
  to_name: string;
  mode: string;
  mode_label: string;
  duration_min: number;
  cost_inr: number;
  route: { legs?: SnapshotLeg[] } | null;
}

interface SnapshotLeg {
  mode?: string;
  label?: string;
  minutes?: number;
  cost_inr?: number | null;
  polyline?: string | null;
}

function legsOf(row: TripRow): Leg[] {
  return (row.route?.legs ?? []).flatMap((l): Leg[] =>
    isMode(l.mode)
      ? [
          {
            mode: l.mode,
            label: l.label ?? '',
            durationMin: l.minutes ?? 0,
            costInr: l.cost_inr ?? undefined,
            polyline: l.polyline ? decodePolyline(l.polyline) : undefined,
          },
        ]
      : [],
  );
}

interface StatsJson {
  trips?: number;
  spent_inr?: number;
  saved_vs_cab_inr?: number;
  mode_mix?: { mode?: string; percent?: number }[];
}

/** History from the user's `trips` (RLS: own rows only). */
export function createSupabaseHistoryService(supabase: SupabaseClient): HistoryService {
  return {
    async getTrips() {
      const { data, error } = await supabase
        .from('trips')
        .select(
          'id, started_at, from_name, to_name, mode, mode_label, duration_min, cost_inr, route',
        )
        .order('started_at', { ascending: false })
        .limit(TRIP_LIMIT)
        .returns<TripRow[]>();
      if (error) throw new Error(error.message);
      const now = new Date();
      return (data ?? []).map((row): Trip => {
        const at = new Date(row.started_at);
        const legs = legsOf(row);
        return {
          id: row.id,
          dayLabel: dayLabel(at, now),
          from: row.from_name,
          to: row.to_name,
          mode: isMode(row.mode) ? row.mode : 'walk',
          modeLabel: row.mode_label,
          startTime: istTime(at),
          durationMin: row.duration_min,
          costInr: row.cost_inr,
          legs,
          path: legs.flatMap((l) => l.polyline ?? []),
        };
      });
    },

    async getMonthlyStats(): Promise<MonthlyStats> {
      const { data, error } = await supabase.rpc('trip_stats_this_month');
      if (error) throw new Error(error.message);
      const s = (data ?? {}) as StatsJson;
      return {
        trips: s.trips ?? 0,
        spentInr: s.spent_inr ?? 0,
        savedVsCabInr: s.saved_vs_cab_inr ?? 0,
        modeMix: (s.mode_mix ?? []).flatMap((m) =>
          isMode(m.mode) ? [{ mode: m.mode, percent: m.percent ?? 0 }] : [],
        ),
      };
    },

    async clearHistory() {
      const { data } = await supabase.auth.getSession();
      const userId = data.session?.user.id;
      if (!userId) return;
      // Trips and choices first (they reference requests), then requests.
      for (const table of ['trips', 'route_choices', 'route_requests'] as const) {
        const { error } = await supabase.from(table).delete().eq('user_id', userId);
        if (error) throw new Error(error.message);
      }
    },
  };
}
