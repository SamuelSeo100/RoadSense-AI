import { AppState } from 'react-native';

/** The shape supabase-js resolves with (it reports failures, it doesn't throw). */
export interface WriteResult {
  error: { code?: string; message: string } | null;
}

interface Write {
  label: string;
  run: () => PromiseLike<WriteResult>;
}

/** fetch failures have no Postgres/PostgREST code; server rejections do. */
const isNetworkError = (e: { code?: string }) => !e.code;

const MAX_PENDING = 200;
const RETRY_MS = 30_000;

const devLog = (label: string, message: string) => {
  if (__DEV__) console.info(`[tripLog] ${label}: ${message}`);
};

/**
 * Fire-and-forget writes with an in-memory queue. Writes that fail because
 * the device is offline wait, in order (choices reference requests), and are
 * retried once the app looks online again: on returning to the foreground,
 * after the next successful write, or on a 30 s timer while anything waits.
 * Being offline never uses up a write: it's retried once the server is
 * reachable, and dropped only if the server rejects it.
 */
export function createWriteQueue() {
  const pending: Write[] = [];
  let flushing = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  /** Writes run one at a time, in submit order (a choice needs its request first). */
  let chain: Promise<unknown> = Promise.resolve();

  const schedule = () => {
    if (timer || pending.length === 0) return;
    timer = setTimeout(() => {
      timer = null;
      void flush();
    }, RETRY_MS);
  };

  const enqueue = (w: Write) => {
    pending.push(w);
    if (pending.length > MAX_PENDING) pending.shift();
    schedule();
  };

  /** 'ok' | 'offline' (keep queued) | 'failed' (dropped). */
  async function attempt(w: Write): Promise<'ok' | 'offline' | 'failed'> {
    try {
      const { error } = await w.run();
      if (!error) return 'ok';
      if (isNetworkError(error)) return 'offline';
      devLog(w.label, error.message);
      return 'failed';
    } catch (e) {
      // Thrown errors from fetch are network failures.
      devLog(w.label, e instanceof Error ? e.message : String(e));
      return 'offline';
    }
  }

  async function flush() {
    if (flushing) return;
    flushing = true;
    try {
      while (pending.length > 0) {
        const w = pending[0];
        if (!w) break;
        // Still offline: stop, keeping the order for the next try.
        if ((await attempt(w)) === 'offline') break;
        pending.shift();
      }
    } finally {
      flushing = false;
      schedule();
    }
  }

  AppState.addEventListener('change', (state) => {
    if (state === 'active') void flush();
  });

  return {
    /** Runs the write now (or after earlier queued ones). Never throws. */
    submit(label: string, run: () => PromiseLike<WriteResult>): Promise<boolean> {
      const w: Write = { label, run };
      const done = chain.then(async () => {
        if (pending.length > 0) {
          enqueue(w);
          void flush();
          return false;
        }
        const result = await attempt(w);
        if (result === 'offline') enqueue(w);
        return result === 'ok';
      });
      chain = done.catch(() => undefined);
      return done.catch(() => false);
    },
  };
}
