import AsyncStorage from '@react-native-async-storage/async-storage';
import { addNetworkStateListener } from 'expo-network';
import { AppState } from 'react-native';

/** The shape supabase-js resolves with (it reports failures, it doesn't throw). */
export interface WriteResult {
  error: { code?: string; message: string } | null;
}

/** One insert, as stored on the device. `id` is the row's primary key too. */
export interface QueuedWrite {
  id: string;
  table: string;
  row: Record<string, unknown>;
}

interface WriteQueueOptions {
  /** AsyncStorage key prefix (one key per write, plus an index key for the order). */
  storageKey: string;
  /** Performs the insert. A result without an error code means "try again later". */
  run: (w: QueuedWrite) => PromiseLike<WriteResult>;
  /** Called after each write lands (including ones from an earlier app session). */
  onWritten?: (w: QueuedWrite) => void;
}

/** fetch failures have no Postgres/PostgREST code; server rejections do. */
const isNetworkError = (e: { code?: string }) => !e.code;
/** Expired / invalid JWT (e.g. the token refresh failed while offline): retry once refreshed. */
const isAuthError = (e: { code?: string }) => e.code === 'PGRST301' || e.code === 'PGRST303';
/** The row is already there: an earlier attempt landed but its response was lost. */
const isDuplicate = (e: { code?: string }) => e.code === '23505';

const MAX_PENDING = 200;
const RETRY_MS = 30_000;

const devLog = (label: string, message: string) => {
  if (__DEV__) console.info(`[tripLog] ${label}: ${message}`);
};

/**
 * Fire-and-forget inserts through a queue persisted in AsyncStorage, so writes
 * survive the app being killed. Every write is stored before it's sent and
 * removed once the server has it (or rejects it). Writes run one at a time in
 * submit order (choices reference requests). While offline they wait and are
 * retried on app start, when the network comes back, on returning to the
 * foreground, after the next submit, and on a 30 s timer. At most 200 wait;
 * beyond that the oldest are dropped.
 */
export function createWriteQueue({ storageKey, run, onWritten }: WriteQueueOptions) {
  const indexKey = `${storageKey}:index`;
  const itemKey = (id: string) => `${storageKey}:${id}`;

  let pending: QueuedWrite[] = [];
  let flushing = false;
  let timer: ReturnType<typeof setTimeout> | null = null;

  /** Restore what an earlier session left; anything submitted meanwhile goes after it. */
  const loaded = (async () => {
    try {
      const ids: unknown = JSON.parse((await AsyncStorage.getItem(indexKey)) ?? '[]');
      if (!Array.isArray(ids) || ids.length === 0) return;
      const entries = await AsyncStorage.multiGet(ids.map((id) => itemKey(String(id))));
      const stored = entries.flatMap(([, json]) => (json ? [JSON.parse(json) as QueuedWrite] : []));
      const fresh = new Set(pending.map((w) => w.id));
      pending = [...stored.filter((w) => !fresh.has(w.id)), ...pending];
      devLog('queue', `restored ${stored.length} pending write(s)`);
    } catch (e) {
      devLog('queue', `restore failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  })();

  /** Storage updates run in order, and never before the restore has read the old index. */
  let saving: Promise<unknown> = loaded;
  const save = (op: () => Promise<unknown>) => {
    saving = saving.then(op).catch((e: unknown) => {
      devLog('queue', `storage: ${e instanceof Error ? e.message : String(e)}`);
    });
  };
  const indexEntry = (): [string, string] => [indexKey, JSON.stringify(pending.map((w) => w.id))];

  const remove = (dropped: QueuedWrite[]) => {
    if (dropped.length === 0) return;
    const gone = new Set(dropped);
    pending = pending.filter((w) => !gone.has(w));
    save(async () => {
      await AsyncStorage.multiRemove(dropped.map((w) => itemKey(w.id)));
      await AsyncStorage.setItem(...indexEntry());
    });
  };

  const schedule = () => {
    if (timer || pending.length === 0) return;
    timer = setTimeout(() => {
      timer = null;
      void flush();
    }, RETRY_MS);
  };

  async function attempt(w: QueuedWrite): Promise<'ok' | 'retry' | 'failed'> {
    try {
      const { error } = await run(w);
      if (!error || isDuplicate(error)) return 'ok';
      if (isNetworkError(error) || isAuthError(error)) return 'retry';
      devLog(w.table, error.message);
      return 'failed';
    } catch (e) {
      // Thrown errors from fetch are network failures.
      devLog(w.table, e instanceof Error ? e.message : String(e));
      return 'retry';
    }
  }

  async function flush() {
    if (flushing) return;
    flushing = true;
    try {
      await loaded;
      let w: QueuedWrite | undefined;
      while ((w = pending[0])) {
        const result = await attempt(w);
        // Still offline: stop, keeping the order for the next try.
        if (result === 'retry') break;
        remove([w]);
        if (result === 'ok') onWritten?.(w);
      }
    } finally {
      flushing = false;
      schedule();
    }
  }

  AppState.addEventListener('change', (state) => {
    if (state === 'active') void flush();
  });
  addNetworkStateListener(({ isConnected, isInternetReachable }) => {
    if (isConnected && isInternetReachable !== false) void flush();
  });
  void flush();

  return {
    /** Stores the write, then sends it (after earlier queued ones). Never throws. */
    submit(table: string, row: Record<string, unknown> & { id: string }) {
      const w: QueuedWrite = { id: row.id, table, row };
      pending.push(w);
      save(() => AsyncStorage.multiSet([[itemKey(w.id), JSON.stringify(w)], indexEntry()]));
      remove(pending.slice(0, Math.max(0, pending.length - MAX_PENDING)));
      void flush();
    },

    /** Drops everything waiting (e.g. the user cleared their history). */
    clear() {
      remove([...pending]);
    },
  };
}
