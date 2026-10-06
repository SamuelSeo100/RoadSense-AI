import { Fragment } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import type { RankedRoute } from '@/services/types';
import { colors, fonts, radius, shadows } from '@/theme/routly';

import { ModePill } from './ModePill';
import { RText } from './RText';
import { formatInr, formatTransfers, formatWalking, trafficTextColor } from './routeFormat';

interface RouteCardProps {
  route: RankedRoute;
  onPress: () => void;
}

/** Ranked route on the Routes tab. The best one is badged and outlined. */
export function RouteCard({ route, onPress }: RouteCardProps) {
  const best = route.isBest;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${best ? 'Best for you. ' : ''}${route.durationMin} minutes, ${formatInr(route.costInr)}, ${route.legs.map((l) => l.label).join(', then ')}`}
      style={[styles.card, best ? [styles.best, shadows.selectedCard] : styles.normal]}
    >
      {best && (
        <View style={styles.badge}>
          <RText variant="badge" color={colors.textOnPrimary}>
            ★ BEST FOR YOU
          </RText>
        </View>
      )}

      <View style={styles.row}>
        <RText variant="bigNumber">
          {route.durationMin}
          <RText variant="caption" size={13}>
            {' '}
            min
          </RText>
        </RText>
        <RText variant="price">{formatInr(route.costInr)}</RText>
      </View>

      <View style={styles.legs}>
        {route.legs.map((leg, i) => (
          <Fragment key={`${leg.label}-${i}`}>
            {i > 0 && (
              <RText variant="body" color={colors.separator}>
                ›
              </RText>
            )}
            <ModePill mode={leg.mode} label={leg.label} />
          </Fragment>
        ))}
      </View>

      <View style={styles.footer}>
        <Stat label="Walking" value={formatWalking(route.walkingKm)} />
        <Stat label="Transfers" value={formatTransfers(route.transfers)} />
        <Stat label="Traffic" value={route.traffic} color={trafficTextColor[route.traffic]} />
      </View>
    </Pressable>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={styles.stat}>
      <RText variant="small">{label}</RText>
      <RText variant="body" family={fonts.bold} color={color}>
        {value}
      </RText>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius.card, padding: 16, gap: 12 },
  // 1px border + 1px padding = same outer size as the 2px best border.
  normal: { borderWidth: 1, borderColor: colors.border, padding: 17 },
  best: { borderWidth: 2, borderColor: colors.primary, padding: 16 },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  legs: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  footer: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 12,
  },
  stat: { flex: 1, gap: 2 },
});
