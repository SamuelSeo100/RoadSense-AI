import { useCallback, useState } from 'react';

/**
 * Tracks pending/error state for one async action (sign in, send OTP…).
 * Replaced by react-query mutations when auth is wired in Phase 4.
 */
export function useAsyncAction<Args extends unknown[]>(action: (...args: Args) => Promise<void>) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    async (...args: Args): Promise<{ ok: boolean; error: string | null }> => {
      setPending(true);
      setError(null);
      try {
        await action(...args);
        return { ok: true, error: null };
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Something went wrong. Please try again.';
        setError(message);
        return { ok: false, error: message };
      } finally {
        setPending(false);
      }
    },
    [action],
  );

  return { run, pending, error, clearError: () => setError(null) };
}
