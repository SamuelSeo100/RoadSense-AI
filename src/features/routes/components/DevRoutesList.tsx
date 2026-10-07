import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { RText } from '@/components/routly/RText';
import { routingService, type LatLng, type Place, type RankedRoute } from '@/services';
import { useRoutlyPrefs } from '@/store/routlyPrefsStore';
import { colors, radius } from '@/theme/routly';

interface DevResult {
  key: string;
  routes?: RankedRoute[];
  error?: string;
}

const NO_VEHICLES = { car: false, bike: false, cycle: false };

/**
 * TODO(routes-ui): replace in Feature 2. Dev-only dump of `routingService.getRoutes`
 * so the Google routing can be checked on a device. Not the real route cards.
 */
export function DevRoutesList({ start, to }: { start: LatLng; to: Place }) {
  const prefs = useRoutlyPrefs((s) => s.prefs);
  const priority = prefs?.defaultPriority ?? 'fastest';
  const vehicles = prefs?.vehicles ?? NO_VEHICLES;
  const requestKey = `${start.latitude},${start.longitude}>${to.id}|${priority}|${JSON.stringify(vehicles)}`;
  const [result, setResult] = useState<DevResult>();
  // Results of an older request count as "loading".
  const state: Partial<DevResult> = result?.key === requestKey ? result : {};

  useEffect(() => {
    const controller = new AbortController();
    routingService
      .getRoutes(start, to, { priority, vehicles, signal: controller.signal })
      .then((routes) => !controller.signal.aborted && setResult({ key: requestKey, routes }))
      .catch((e: unknown) => {
        if (!controller.signal.aborted)
          setResult({ key: requestKey, error: e instanceof Error ? e.message : String(e) });
      });
    return () => controller.abort();
  }, [requestKey, start, to, priority, vehicles]);

  return (
    <View style={styles.box}>
      <RText variant="caption">DEV · getRoutes ({priority})</RText>
      {!state.routes && !state.error && <RText variant="caption">Loading…</RText>}
      {state.error && <RText variant="caption">Error: {state.error}</RText>}
      {state.routes?.map((r) => (
        <View key={r.id} style={styles.row}>
          <RText variant="body">
            {r.rank}. {r.name}
            {r.aiPick ? ' (AI pick)' : ''} · {r.durationMin} min · ₹{r.costInr} · {r.walkingKm} km
            walk · {r.transfers} transfers
          </RText>
          <RText variant="caption">
            {r.legs
              .map(
                (l) =>
                  `${l.label}${l.costInr !== undefined ? ` ₹${l.costInr}` : ''}${l.approximate ? ' ~' : ''}`,
              )
              .join(' → ')}
          </RText>
          {r.meta && <RText variant="caption">{r.meta}</RText>}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
    borderRadius: radius.card,
    padding: 12,
    gap: 8,
  },
  row: { gap: 2 },
});
