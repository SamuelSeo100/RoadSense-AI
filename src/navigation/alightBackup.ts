/**
 * When the time-based "get off at the next stop" backup should fire: it
 * reaches a locked phone, where foreground GPS has stopped.
 */
import type { NavStep } from './steps';

/** Closer than this, the GPS alert (screen on) is due anyway: no backup. */
export const MIN_BACKUP_LEAD_MS = 30_000;

/**
 * One stop's worth before the predicted arrival. The ride starts at the
 * detected boarding time when known, else at the later of the scheduled
 * departure and the time the user reached the boarding stop. Null for
 * non-ride steps or when that moment is less than 30 s away.
 */
export function alightBackupAt(
  step: NavStep,
  { reachedStopAt, boardedAt, now }: { reachedStopAt: number; boardedAt?: number; now: number },
): number | null {
  const t = step.transit;
  if (!t) return null;
  const dep = t.scheduledDep ? Date.parse(t.scheduledDep) : NaN;
  const start = boardedAt ?? Math.max(reachedStopAt, Number.isFinite(dep) ? dep : reachedStopAt);
  const rideMs = step.predictedDurationS * 1000;
  const perStopMs = t.stopCount > 0 ? rideMs / t.stopCount : 0;
  const at = start + rideMs - perStopMs;
  return at - now < MIN_BACKUP_LEAD_MS ? null : at;
}
