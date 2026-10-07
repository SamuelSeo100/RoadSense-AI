import { Fragment, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import type { RankedRoute } from '@/services/types';
import { colors, fonts, radius, shadows } from '@/theme/routly';

import { ModePill } from './ModePill';
import { PressableBox } from './PressableBox';
import { RText } from './RText';
import {
  formatTransfers,
  formatWalking,
  routeCost,
  shortLegLabel,
  trafficTextColor,
} from './routeFormat';

interface RouteCardProps {
  route: RankedRoute;
  /** "Fastest", "Least walking"… for the "Best for" badge. */
  priorityLabel: string;
  /** Selected = shown on the map (outlined). */
  selected: boolean;
  onPress: () => void;
  /** Expanded detail (step list), rendered under the summary. */
  children?: ReactNode;
}

/**
 * Ranked route on the Routes tab: leg strip, time, cost, walk/transfers/traffic.
 * One badge at most: "AI pick" wins over "Best for <priority>".
 */
export function RouteCard({ route, priorityLabel, selected, onPress, children }: RouteCardProps) {
  const badge = route.aiPick
    ? 'AI PICK'
    : route.isBest
      ? `BEST FOR ${priorityLabel.toUpperCase()}`
      : null;
  const cost = routeCost(route);
  return (
    <View style={[styles.card, selected ? [styles.selected, shadows.selectedCard] : styles.normal]}>
      <PressableBox
        onPress={onPress}
        accessibilityRole="button"
        accessibilityState={{ selected, expanded: children !== undefined }}
        accessibilityLabel={`${badge ? `${badge.toLowerCase()}. ` : ''}${route.name}, ${route.durationMin} minutes, ${cost}, ${route.legs.map((l) => l.label).join(', then ')}`}
        style={styles.summary}
        pressedStyle={styles.pressed}
      >
        {badge && (
          <View style={[styles.badge, route.aiPick ? styles.aiBadge : styles.bestBadge]}>
            <RText variant="badge" color={route.aiPick ? colors.primary : colors.textOnPrimary}>
              {route.aiPick ? '✦ ' : '★ '}
              {badge}
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
          <RText variant="price" style={styles.price} numberOfLines={1}>
            {cost}
          </RText>
        </View>

        <View style={styles.legs}>
          {route.legs.map((leg, i) => (
            <Fragment key={`${leg.label}-${i}`}>
              {i > 0 && (
                <RText variant="body" color={colors.separator}>
                  ›
                </RText>
              )}
              <ModePill mode={leg.mode} label={shortLegLabel(leg)} icon />
            </Fragment>
          ))}
        </View>

        <View style={styles.footer}>
          <Stat label="Walking" value={formatWalking(route.walkingKm)} />
          <Stat label="Transfers" value={formatTransfers(route.transfers)} />
          <Stat label="Traffic" value={route.traffic} color={trafficTextColor[route.traffic]} />
        </View>
      </PressableBox>
      {children}
    </View>
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
  card: { backgroundColor: colors.surface, borderRadius: radius.card, gap: 12 },
  // 1px border + 1px padding = same outer size as the 2px selected border.
  normal: { borderWidth: 1, borderColor: colors.border, padding: 17 },
  selected: { borderWidth: 2, borderColor: colors.primary, padding: 16 },
  summary: { gap: 12 },
  pressed: { opacity: 0.85 },
  badge: {
    alignSelf: 'flex-start',
    borderRadius: radius.pill,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  bestBadge: { backgroundColor: colors.primary },
  aiBadge: { backgroundColor: colors.primaryTint },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 },
  price: { flexShrink: 1, textAlign: 'right' },
  legs: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  footer: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 12,
  },
  stat: { flex: 1, gap: 2 },
});
