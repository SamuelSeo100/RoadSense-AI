/**
 * Runs the AI Mode test phrases against the deployed `parse-trip` function
 * and prints each parse, latency and token usage.
 *
 *   ROUTLY_TEST_EMAIL=… ROUTLY_TEST_PASSWORD=… node --env-file=.env scripts/test-parse-trip.mts
 *
 * Needs EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY (from
 * .env) and an email/password account (calls count toward its hourly limit
 * and are logged to its ai_queries). Prints no keys or tokens.
 */
import { createClient } from '@supabase/supabase-js';

const PHRASES = [
  'sabse sasta way to Swargate',
  'metro se Hinjewadi jaana hai, no bus',
  'reach Pune station by 9',
  'ghar',
  'college fastest',
  'Kothrud to Viman Nagar least walking',
  'mala FC road la jaycha aahe',
];

/** claude-haiku-4-5, USD per million tokens (supabase/functions/parse-trip/config.ts). */
const PRICE = { input: 1, output: 5 };

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const email = process.env.ROUTLY_TEST_EMAIL;
const password = process.env.ROUTLY_TEST_PASSWORD;
if (!url || !key || !email || !password) {
  console.error(
    'Set EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY (in .env), ' +
      'ROUTLY_TEST_EMAIL and ROUTLY_TEST_PASSWORD.',
  );
  process.exit(1);
}

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const istNow = () => `${new Date(Date.now() + IST_OFFSET_MS).toISOString().slice(0, 19)}+05:30`;

const supabase = createClient(url, key, { auth: { persistSession: false } });
const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
if (signInError) {
  console.error(`Sign-in failed: ${signInError.message}`);
  process.exit(1);
}

let inputTokens = 0;
let outputTokens = 0;
let failures = 0;
console.log(`now (IST): ${istNow()}\n`);
for (const text of PHRASES) {
  const started = Date.now();
  const { data, error } = await supabase.functions.invoke('parse-trip', {
    body: {
      text,
      now: istNow(),
      savedPlaces: [
        { label: 'Home', name: 'Kothrud' },
        { label: 'College', name: 'COEP Technological University' },
        { label: 'Work' },
      ],
      learnFromTrips: true,
    },
  });
  const ms = Date.now() - started;
  if (error) {
    failures++;
    let detail = error.message;
    const ctx = (error as { context?: Response }).context;
    if (ctx && typeof ctx.text === 'function') detail += ` ${await ctx.text().catch(() => '')}`;
    console.log(`✗ "${text}"\n    error: ${detail} (${ms} ms)\n`);
    continue;
  }
  inputTokens += data.usage?.inputTokens ?? 0;
  outputTokens += data.usage?.outputTokens ?? 0;
  console.log(
    `✓ "${text}"\n    ${JSON.stringify(data.query)}\n    ${data.latencyMs} ms LLM · ${ms} ms total · ` +
      `${data.usage?.inputTokens} in / ${data.usage?.outputTokens} out tokens\n`,
  );
}

const ok = PHRASES.length - failures;
if (ok > 0) {
  const perQuery =
    ((inputTokens / ok) * PRICE.input + (outputTokens / ok) * PRICE.output) / 1_000_000;
  console.log(
    `avg ${Math.round(inputTokens / ok)} in / ${Math.round(outputTokens / ok)} out tokens · ` +
      `≈ $${(perQuery * 100).toFixed(3)} per 100 queries`,
  );
}
// Local only: a global sign-out would revoke this account's sessions on devices too.
await supabase.auth.signOut({ scope: 'local' });
process.exit(failures ? 1 : 0);
