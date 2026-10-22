import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { PressableBox } from '@/components/routly/PressableBox';
import { RText } from '@/components/routly/RText';
import type { BusEta, BusEtaSource, Leg } from '@/services';
import { colors, radius } from '@/theme/routly';

import { useBusEta } from '../../trip/busEtaStore';

const BADGE: Record<BusEtaSource, string> = {
  scheduled_traffic: 'Scheduled + traffic',
  scheduled: 'Scheduled',
};

/** "7–11", or "7" when the range rounds to one number. */
function range(low: number, high: number): string {
  const lo = Math.round(low);
  const hi = Math.max(lo, Math.round(high));
  return lo === hi ? `${lo}` : `${lo}–${hi}`;
}

/** "Arrives at stop in ~7–11 min", relative to `now`. */
function arrivalText(eta: BusEta, now: number): string {
  const low = (eta.departLowAt - now) / 60_000;
  const high = (eta.departHighAt - now) / 60_000;
  if (high < 1) return 'May have left your stop';
  if (low < 1) return `Due at stop within ~${Math.round(high)} min`;
  return `Arrives at stop in ~${range(low, high)} min`;
}

function explanation(eta: BusEta, pending: boolean): string {
  if (eta.source === 'scheduled_traffic')
    return 'Bus timetable, adjusted for road traffic now between these stops, plus a margin for delays. Not live bus tracking.';
  return pending
    ? 'Bus timetable, plus a margin for delays. Checking road traffic… Not live bus tracking.'
    : 'Bus timetable only (no traffic data), plus a margin for delays. Not live bus tracking.';
}

/** Minutes until the bus are relative: re-render on a slow tick. */
function useNow(everyMs: number): number {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), everyMs);
    return () => clearInterval(timer);
  }, [everyMs]);
  return now;
}

/** Bus leg row: when it reaches your stop, the ride range and where that comes from. */
export function BusEtaInfo({ leg }: { leg: Leg }) {
  const result = useBusEta(leg);
  const now = useNow(30_000);
  const [explained, setExplained] = useState(false);
  if (!result) return null;
  const { eta, pending } = result;
  const withTraffic = eta.source === 'scheduled_traffic';
  const label = BADGE[eta.source];
  return (
    <View style={styles.wrap}>
      <RText variant="caption" numberOfLines={2}>
        {arrivalText(eta, now)} · ride ~{range(eta.rideLowMin, eta.rideHighMin)} min
      </RText>
      <PressableBox
        onPress={() => setExplained((e) => !e)}
        accessibilityRole="button"
        accessibilityLabel={`${label}, not live. How this is estimated`}
        accessibilityState={{ expanded: explained }}
        hitSlop={8}
        style={[styles.badge, withTraffic && styles.badgeTraffic]}
      >
        <RText variant="small" color={withTraffic ? colors.primary : colors.textSecondary}>
          {label} ⓘ
        </RText>
      </PressableBox>
      {explained && <RText variant="small">{explanation(eta, pending)}</RText>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 2, marginTop: 2 },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: radius.pill,
    backgroundColor: colors.divider,
  },
  badgeTraffic: { backgroundColor: colors.primaryTint },
});
