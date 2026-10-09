import type { SupabaseClient } from '@supabase/supabase-js';

import {
  MODES,
  PRIORITIES,
  type AiQuery,
  type AiService,
  type Mode,
  type ModeFilter,
} from '../types';

/** The function's own LLM timeout is 8 s; this covers cold start + network. */
const CLIENT_TIMEOUT_MS = 10_000;

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
/** "2026-10-09T17:42:05+05:30", whatever the device zone. */
export function istIso(at: Date): string {
  return `${new Date(at.getTime() + IST_OFFSET_MS).toISOString().slice(0, 19)}+05:30`;
}

const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined);
const modes = (v: unknown): Mode[] | undefined => {
  const list = Array.isArray(v) ? v.filter((m): m is Mode => MODES.includes(m as Mode)) : [];
  return list.length ? list : undefined;
};

/** Defensive: the app only trusts fields it knows. */
function toQuery(raw: unknown): AiQuery | null {
  if (!raw || typeof raw !== 'object') return null;
  const q = raw as Record<string, unknown>;
  const m = (q.modes ?? {}) as Record<string, unknown>;
  const filter: ModeFilter = { include: modes(m.include), exclude: modes(m.exclude) };
  const to = str(q.to);
  const clarify = str(q.clarify);
  if (!to && !clarify) return null;
  return {
    from: str(q.from),
    to,
    priority: PRIORITIES.find((p) => p === q.priority),
    modes: filter.include || filter.exclude ? filter : undefined,
    departAt: str(q.departAt),
    arriveBy: str(q.arriveBy),
    clarify: to ? undefined : clarify,
    clarifyOptions: Array.isArray(q.clarifyOptions)
      ? q.clarifyOptions.flatMap((o) => (str(o) ? [str(o) as string] : [])).slice(0, 3)
      : undefined,
    source: 'llm',
  };
}

/**
 * AI Mode through the `parse-trip` edge function (Claude; the key stays on
 * the server). Any failure (offline, timeout, rate limit, bad key) falls back
 * to the keyword parser, so AI Mode never fully breaks.
 */
export function createSupabaseAiService(supabase: SupabaseClient, fallback: AiService): AiService {
  return {
    async parseQuery(text, context) {
      try {
        // The function verifies the user's JWT: send the current session token
        // explicitly, and skip the call (keywords only) when signed out.
        const { data: auth } = await supabase.auth.getSession();
        const token = auth.session?.access_token;
        if (!token) throw new Error('not signed in');
        const { data, error } = await supabase.functions.invoke('parse-trip', {
          headers: { Authorization: `Bearer ${token}` },
          body: {
            text,
            now: istIso(new Date()),
            userLocation: context.area ? { area: context.area } : undefined,
            savedPlaces: context.savedPlaces,
            learnFromTrips: context.learnFromTrips,
          },
          timeout: CLIENT_TIMEOUT_MS,
        });
        if (error) throw error;
        const query = toQuery((data as { query?: unknown } | null)?.query);
        if (query) return query;
      } catch (e) {
        if (__DEV__) {
          // FunctionsHttpError carries the response: show the function's error code.
          const res = (e as { context?: Response }).context;
          const detail =
            res && typeof res.text === 'function'
              ? `${res.status} ${await res.text().catch(() => '')}`
              : e instanceof Error
                ? e.message
                : String(e);
          console.info(`[ai] parse-trip failed, using keywords: ${detail}`);
        }
      }
      return fallback.parseQuery(text, context);
    },
  };
}
