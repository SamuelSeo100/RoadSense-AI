import { StyleSheet, View } from 'react-native';

import { Icon, modeIcon } from '@/components/routly/Icon';
import { PressableBox } from '@/components/routly/PressableBox';
import { PrimaryButton } from '@/components/routly/PrimaryButton';
import { RText } from '@/components/routly/RText';
import { formatInr, legMinutes } from '@/components/routly/routeFormat';
import type { Leg, Route, WalkingRoute } from '@/services';
import type { BookingTrip } from '@/services/bookings';
import { colors, fonts, modeColors, radius } from '@/theme/routly';

import { book, type BookingKind } from '../../trip/booking';

interface RouteStepsProps {
  route: Route;
  /** "Your location" or the From place. */
  originLabel: string;
  destinationName: string;
  /** Safe-walk details, shown on the walk-only route. */
  walk: WalkingRoute | null;
  onStart: () => void;
}

/** What a leg can be booked / ticketed with (own car and bike: nothing). */
function bookingFor(leg: Leg, route: Route): { kind: BookingKind; label: string } | null {
  switch (leg.mode) {
    case 'metro':
      return { kind: 'metro', label: 'Get ticket' };
    case 'bus':
      return { kind: 'bus', label: 'Get ticket' };
    case 'auto':
      return { kind: 'auto', label: 'Book' };
    case 'cab':
      return route.vehicle === 'car' ? null : { kind: 'cab', label: 'Book' };
    default:
      return null;
  }
}

function legTitle(leg: Leg): string {
  const isTransit = leg.mode === 'metro' || leg.mode === 'bus' || leg.mode === 'train';
  if (isTransit && leg.stops)
    return `${leg.label} · ${leg.stops} stop${leg.stops === 1 ? '' : 's'}`;
  if (leg.mode === 'walk') return leg.distanceKm ? `Walk · ${leg.distanceKm} km` : 'Walk';
  return leg.label;
}

/** Expanded route: one row per leg (from → to, time, fare, actions), then Start. */
export function RouteSteps({
  route,
  originLabel,
  destinationName,
  walk,
  onStart,
}: RouteStepsProps) {
  const isWalkOnly = route.legs.every((l) => l.mode === 'walk');
  return (
    <View style={styles.wrap}>
      {route.legs.map((leg, i) => {
        const from = leg.from ?? route.legs[i - 1]?.to ?? (i === 0 ? originLabel : 'Previous stop');
        const to =
          leg.to ??
          route.legs[i + 1]?.from ??
          (i === route.legs.length - 1 ? destinationName : 'Next stop');
        const action = bookingFor(leg, route);
        const start = leg.polyline?.[0];
        const end = leg.polyline?.[leg.polyline.length - 1];
        const trip: BookingTrip = { pickup: start, drop: end ? { ...end, name: to } : undefined };
        const c = modeColors[leg.mode];
        return (
          <View key={`${leg.label}-${i}`} style={styles.step}>
            <View style={[styles.icon, { backgroundColor: c.pillBg }]}>
              <Icon name={modeIcon[leg.mode]} size={16} color={c.pillText} strokeWidth={2.2} />
            </View>
            <View style={styles.middle}>
              <RText variant="body" size={13} family={fonts.extrabold} numberOfLines={2}>
                {legTitle(leg)}
              </RText>
              <RText variant="caption" numberOfLines={2}>
                {from} → {to}
              </RText>
              {action && (
                <PressableBox
                  onPress={() => book(action.kind, trip)}
                  accessibilityRole="button"
                  accessibilityLabel={`${action.label}: ${leg.label}`}
                  hitSlop={4}
                  style={styles.action}
                  pressedStyle={styles.actionPressed}
                >
                  <RText variant="body" size={12} family={fonts.extrabold} color={colors.primary}>
                    {action.label}
                  </RText>
                </PressableBox>
              )}
            </View>
            <View style={styles.right}>
              <RText variant="body" size={13} family={fonts.extrabold}>
                {legMinutes(leg)}
              </RText>
              {leg.costInr !== undefined && leg.costInr > 0 && (
                <RText variant="caption">{formatInr(leg.costInr)}</RText>
              )}
            </View>
          </View>
        );
      })}

      {isWalkOnly && walk && (
        <View style={styles.notes}>
          {!!walk.via && <RText variant="caption">via {walk.via}</RText>}
          {walk.safety.notes.map((note) => (
            <RText key={note} variant="caption" color={colors.primary}>
              {note}
            </RText>
          ))}
          {walk.warnings.map((w) => (
            <RText key={w} variant="caption" color={colors.traffic.textModerate}>
              ⚠ {w}
            </RText>
          ))}
        </View>
      )}

      {route.legs.some((l) => l.approximate) && (
        <RText variant="small">~ Estimated: straight-line distance, not live directions.</RText>
      )}

      <PrimaryButton
        label={isWalkOnly ? 'Start walking' : 'Start'}
        trailingIcon="arrow-right"
        height={48}
        onPress={onStart}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12 },
  step: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  icon: {
    width: 32,
    height: 32,
    borderRadius: radius.iconBtn,
    alignItems: 'center',
    justifyContent: 'center',
  },
  middle: { flex: 1, gap: 2 },
  right: { alignItems: 'flex-end', minWidth: 48, gap: 2 },
  action: {
    alignSelf: 'flex-start',
    minHeight: 34,
    justifyContent: 'center',
    paddingHorizontal: 12,
    marginTop: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  actionPressed: { backgroundColor: colors.primaryTint },
  notes: { gap: 4 },
});
