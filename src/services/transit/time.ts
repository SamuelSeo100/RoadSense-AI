/** Timetables are in India time; these work whatever the device's zone is. */

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/** Minutes after IST midnight (0–1439.x). */
export function istMinutes(at: Date): number {
  const ist = new Date(at.getTime() + IST_OFFSET_MS);
  return ist.getUTCHours() * 60 + ist.getUTCMinutes() + ist.getUTCSeconds() / 60;
}

/** IST weekday, 0 = Sunday. */
export function istWeekday(at: Date): number {
  return new Date(at.getTime() + IST_OFFSET_MS).getUTCDay();
}

/** "06:05" → 365, "24:10" → 1450; null when malformed. */
export function parseHHMM(s: string | null | undefined): number | null {
  const m = /^(\d{1,2}):([0-5]\d)$/.exec(s?.trim() ?? '');
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

/** 1450 → "00:10" (wraps past midnight). */
export function formatHHMM(min: number): string {
  const total = ((Math.round(min) % 1440) + 1440) % 1440;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
