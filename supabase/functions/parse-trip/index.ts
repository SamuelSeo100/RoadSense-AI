// AI Mode: free text ("sabse sasta way to Swargate") → a structured trip query.
// The app calls this with the user's session; the Anthropic key never leaves
// the server (Supabase secret ANTHROPIC_API_KEY).
import Anthropic from 'npm:@anthropic-ai/sdk@0.132.1';
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.117.2';

import { llmConfig, MAX_SAVED_PLACES, MAX_TEXT_LENGTH } from './config.ts';
import {
  MODES,
  PRIORITIES,
  planTripTool,
  SYSTEM_PROMPT,
  TOOL_NAME,
  userMessage,
} from './prompt.ts';

type Mode = (typeof MODES)[number];
type Priority = (typeof PRIORITIES)[number];

/** What the app receives (mirrors AiQuery in src/services/types.ts). */
interface TripQuery {
  from?: string;
  to?: string;
  priority?: Priority;
  modes?: { include?: Mode[]; exclude?: Mode[] };
  departAt?: string;
  arriveBy?: string;
  clarify?: string;
  clarifyOptions?: string[];
}

interface RequestBody {
  text: string;
  /** ISO 8601 in IST (+05:30), from the device. */
  now: string;
  /** Neighbourhood name only; coordinates are never sent to the LLM. */
  userLocation?: { area?: string };
  savedPlaces: { label: string; name?: string }[];
  /** "Learn from my trips": off → only usage is logged. */
  learnFromTrips: boolean;
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });

const str = (v: unknown, max = 200): string | undefined =>
  typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : undefined;

const modeList = (v: unknown): Mode[] | undefined => {
  if (!Array.isArray(v)) return undefined;
  const list = [...new Set(v.filter((m): m is Mode => MODES.includes(m)))];
  return list.length ? list : undefined;
};

/** ISO time in the future (a minute's slack), else undefined. */
const futureIso = (v: unknown, nowMs: number): string | undefined => {
  const s = str(v, 40);
  if (!s) return undefined;
  const t = Date.parse(s);
  return Number.isFinite(t) && t > nowMs - 60_000 ? s : undefined;
};

function parseBody(raw: unknown): RequestBody | null {
  if (!raw || typeof raw !== 'object') return null;
  const b = raw as Record<string, unknown>;
  const text = str(b.text, MAX_TEXT_LENGTH);
  const now = str(b.now, 40);
  if (!text || !now || !Number.isFinite(Date.parse(now))) return null;
  const saved = Array.isArray(b.savedPlaces) ? b.savedPlaces : [];
  const loc = b.userLocation as Record<string, unknown> | undefined;
  return {
    text,
    now,
    userLocation: loc && typeof loc === 'object' ? { area: str(loc.area, 80) } : undefined,
    savedPlaces: saved.slice(0, MAX_SAVED_PLACES).flatMap((p) => {
      const label = str((p as Record<string, unknown>)?.label, 40);
      return label ? [{ label, name: str((p as Record<string, unknown>).name, 120) }] : [];
    }),
    learnFromTrips: b.learnFromTrips !== false,
  };
}

/** Keeps only valid fields; a query always has `to` or `clarify`. */
/** Words that refer to each fixed saved place (custom labels match themselves). */
const SAVED_WORDS: Record<string, string[]> = {
  home: ['home', 'ghar', 'ghari', 'house'],
  college: ['college', 'clg', 'collage', 'campus'],
  work: ['work', 'office', 'kaam'],
};

/**
 * True when `value` is a saved label the rider never said. The model sometimes
 * fills `from` with "Home" on its own; that would plan from the wrong place
 * (or fail when Home isn't set).
 */
function unspokenSavedLabel(value: string, text: string, saved: RequestBody['savedPlaces']) {
  const label = saved.find((p) => p.label.toLowerCase() === value.toLowerCase())?.label;
  if (!label) return false;
  const words = SAVED_WORDS[label.toLowerCase()] ?? [label.toLowerCase()];
  const said = text.toLowerCase();
  const escape = (w: string) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return !words.some((w) => new RegExp(`(^|[^\\p{L}])${escape(w)}([^\\p{L}]|$)`, 'u').test(said));
}

/** True when `value` is the rider's current area (sent as context) and they didn't say it. */
function unspokenArea(value: string, text: string, area: string | undefined) {
  if (!area) return false;
  const place = value.split(',')[0]?.trim().toLowerCase() ?? '';
  const here = area.toLowerCase();
  if (!place || !(here.includes(place) || place.includes(here))) return false;
  const first = here.split(/\s+/)[0] ?? here;
  return !text.toLowerCase().includes(first);
}

function normalise(input: unknown, nowMs: number, body: RequestBody): TripQuery {
  const i = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const m = (i.modes && typeof i.modes === 'object' ? i.modes : {}) as Record<string, unknown>;
  const include = modeList(m.include);
  const exclude = modeList(m.exclude)?.filter((x) => !include?.includes(x));
  const priority = PRIORITIES.find((p) => p === i.priority);
  // A destination the rider never named (e.g. their own area) → ask instead.
  const rawTo = str(i.to);
  const to = rawTo && unspokenArea(rawTo, body.text, body.userLocation?.area) ? undefined : rawTo;
  const q: TripQuery = {
    from: (() => {
      const from = str(i.from);
      if (!from) return undefined;
      if (unspokenSavedLabel(from, body.text, body.savedPlaces)) return undefined;
      return unspokenArea(from, body.text, body.userLocation?.area) ? undefined : from;
    })(),
    to,
    priority,
    modes:
      include || exclude?.length
        ? { include, exclude: exclude?.length ? exclude : undefined }
        : undefined,
    departAt: futureIso(i.departAt, nowMs),
    arriveBy: futureIso(i.arriveBy, nowMs),
  };
  if (!to) {
    q.clarify = str(i.clarify, 200) ?? 'Where do you want to go?';
    const options = Array.isArray(i.clarifyOptions)
      ? i.clarifyOptions.flatMap((o) => (str(o) ? [str(o)!] : [])).slice(0, 3)
      : [];
    if (options.length) q.clarifyOptions = options;
  }
  return JSON.parse(JSON.stringify(q)); // drop undefined keys
}

async function logQuery(
  db: SupabaseClient,
  row: {
    body: RequestBody;
    status: 'ok' | 'clarify' | 'error' | 'timeout';
    result: TripQuery | null;
    latencyMs: number;
    inputTokens: number;
    outputTokens: number;
  },
) {
  const learn = row.body.learnFromTrips;
  const { error } = await db.from('ai_queries').insert({
    text: learn ? row.body.text : null,
    result: learn ? row.result : null,
    status: row.status,
    model: llmConfig.model,
    latency_ms: Math.round(row.latencyMs),
    input_tokens: row.inputTokens,
    output_tokens: row.outputTokens,
  });
  if (error) console.error(`parse-trip: ai_queries insert failed: ${error.message}`);
}

const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY') ?? '';
const anthropic = anthropicKey ? new Anthropic({ apiKey: anthropicKey }) : null;
const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseKey =
  Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('SUPABASE_PUBLISHABLE_KEY') ?? '';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });

  // --- Auth: the caller's Supabase session JWT.
  const authorization = req.headers.get('Authorization') ?? '';
  const jwt = authorization.replace(/^Bearer\s+/i, '');
  if (!jwt) return json(401, { error: 'unauthorized' });
  const db = createClient(supabaseUrl, supabaseKey, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: authError } = await db.auth.getUser(jwt);
  if (authError || !userData.user) return json(401, { error: 'unauthorized' });

  let body: RequestBody | null = null;
  try {
    body = parseBody(await req.json());
  } catch {
    body = null;
  }
  if (!body) return json(400, { error: 'bad_request' });

  // --- Rate limit (counted in SQL, per user per hour).
  const { data: allowed, error: limitError } = await db.rpc('ai_rate_limit_hit');
  if (limitError) {
    console.error(`parse-trip: rate limit check failed: ${limitError.message}`);
    return json(500, { error: 'rate_limit_unavailable' });
  }
  if (allowed !== true) return json(429, { error: 'rate_limited' });

  if (!anthropic) {
    console.error(
      'parse-trip: ANTHROPIC_API_KEY is not set (supabase secrets set ANTHROPIC_API_KEY=…)',
    );
    return json(500, { error: 'llm_not_configured' });
  }

  const started = performance.now();
  const nowMs = Date.parse(body.now);
  try {
    const message = await anthropic.messages.create(
      {
        model: llmConfig.model,
        max_tokens: llmConfig.maxTokens,
        system: SYSTEM_PROMPT,
        tools: [planTripTool],
        tool_choice: { type: 'tool', name: TOOL_NAME },
        messages: [
          {
            role: 'user',
            content: userMessage({
              text: body.text,
              now: body.now,
              savedPlaces: body.savedPlaces,
              userArea: body.userLocation?.area,
            }),
          },
        ],
      },
      { timeout: llmConfig.timeoutMs, maxRetries: 0 },
    );
    const latencyMs = performance.now() - started;
    const tool = message.content.find(
      (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use' && b.name === TOOL_NAME,
    );
    const query = normalise(tool?.input, nowMs, body);
    const usage = {
      inputTokens: message.usage.input_tokens,
      outputTokens: message.usage.output_tokens,
    };
    await logQuery(db, {
      body,
      status: query.clarify ? 'clarify' : 'ok',
      result: query,
      latencyMs,
      ...usage,
    });
    return json(200, { query, usage, latencyMs: Math.round(latencyMs), model: llmConfig.model });
  } catch (e) {
    const latencyMs = performance.now() - started;
    const timedOut = e instanceof Anthropic.APIConnectionTimeoutError;
    if (e instanceof Anthropic.AuthenticationError) {
      console.error(
        'parse-trip: invalid API key — Anthropic returned 401. Update the ANTHROPIC_API_KEY secret.',
      );
    } else if (e instanceof Anthropic.RateLimitError) {
      console.error('parse-trip: Anthropic rate limit (429).');
    } else if (timedOut) {
      console.error(`parse-trip: Anthropic call timed out after ${llmConfig.timeoutMs} ms.`);
    } else if (e instanceof Anthropic.APIError) {
      console.error(`parse-trip: Anthropic API error ${e.status}: ${e.message}`);
    } else {
      console.error(`parse-trip: ${e instanceof Error ? e.message : String(e)}`);
    }
    await logQuery(db, {
      body,
      status: timedOut ? 'timeout' : 'error',
      result: null,
      latencyMs,
      inputTokens: 0,
      outputTokens: 0,
    });
    return json(timedOut ? 504 : 502, { error: timedOut ? 'llm_timeout' : 'llm_error' });
  }
});
