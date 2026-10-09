import { modeNames, type ModeFilter, type Route } from '@/services';

/**
 * AI Mode's mode filter on results. `include` = only those modes ride (walks
 * are always allowed): "metro se" → Metro only. `exclude` = none of those legs.
 */
export function matchesModes(route: Pick<Route, 'legs'>, filter: ModeFilter | null): boolean {
  if (!filter) return true;
  const { include, exclude } = filter;
  const riding = route.legs.filter((l) => l.mode !== 'walk');
  if (exclude?.length && route.legs.some((l) => exclude.includes(l.mode))) return false;
  if (include?.length) {
    return riding.length > 0 && riding.every((l) => include.includes(l.mode));
  }
  return true;
}

/** "Metro only", "No bus", "Metro only · no bus". */
export function modeFilterLabel({ include, exclude }: ModeFilter): string {
  const parts: string[] = [];
  if (include?.length) parts.push(`${include.map((m) => modeNames[m]).join(' / ')} only`);
  if (exclude?.length) {
    const names = exclude.map((m) => modeNames[m].toLowerCase()).join(', ');
    parts.push(parts.length ? `no ${names}` : `No ${names}`);
  }
  return parts.join(' · ');
}
