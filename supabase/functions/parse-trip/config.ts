/** The LLM behind AI Mode. Change provider/model here only. */
export const llmConfig = {
  provider: 'anthropic',
  model: 'claude-haiku-4-5',
  /** The tool call is ~100 tokens; this leaves headroom for a clarify question. */
  maxTokens: 400,
  /** Whole call, no retries: the app falls back to its keyword parser. */
  timeoutMs: 8000,
  /** USD per million tokens, for the cost estimate in logs. */
  pricePerMTok: { input: 1, output: 5 },
} as const;

/** Calls per user per clock hour (enforced in SQL: public.ai_rate_limit_hit). */
export const RATE_LIMIT_PER_HOUR = 30;

export const MAX_TEXT_LENGTH = 500;
export const MAX_SAVED_PLACES = 8;
