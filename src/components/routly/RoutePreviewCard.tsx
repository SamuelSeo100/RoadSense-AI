import { Pressable, StyleSheet, View } from 'react-native';

import type { Route } from '@/services/types';
import { colors, fonts, modeColors, radius, shadows } from '@/theme/routly';

import { RText } from './RText';
import { formatInr, primaryMode, TOP_PICK_LABEL } from './routeFormat';

interface RoutePreviewCardProps {
  route: Route;
  selected: boolean;
  onPress: () => void;
}

export const PREVIEW_CARD_WIDTH = 232;

/** Compact route card in Home's horizontal list. */
export function RoutePreviewCard({ route, selected, onPress }: RoutePreviewCardProps) {
  const legs = route.legs.map((l) => l.label).join(' › ');
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`${route.name}, ${route.durationMin} minutes, ${formatInr(route.costInr)}${route.aiPick ? `, ${TOP_PICK_LABEL.toLowerCase()}` : ''}`}
      style={[styles.card, selected ? [styles.selected, shadows.selectedCard] : styles.unselected]}
    >
      {route.aiPick && (
        <View style={styles.aiBadge}>
          <RText variant="badge" size={10} family={fonts.extrabold} color={colors.primary}>
            {TOP_PICK_LABEL.toUpperCase()}
          </RText>
        </View>
      )}
      <View style={styles.row}>
        <RText variant="price">
          {route.durationMin}
          <RText variant="caption"> min</RText>
        </RText>
        <RText variant="body" size={16} family={fonts.extrabold}>
          {formatInr(route.costInr)}
        </RText>
      </View>
      <View style={styles.legsRow}>
        <View style={[styles.dot, { backgroundColor: modeColors[primaryMode(route)].line }]} />
        <RText
          variant="body"
          size={12}
          family={fonts.bold}
          color={colors.textLegs}
          numberOfLines={1}
        >
          {legs}
        </RText>
      </View>
      {route.meta && (
        <RText variant="small" numberOfLines={1}>
          {route.meta}
        </RText>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: PREVIEW_CARD_WIDTH,
    backgroundColor: colors.surface,
    borderRadius: radius.cardSm,
    gap: 8,
  },
  unselected: { borderWidth: 1, borderColor: colors.border, padding: 15 },
  selected: { borderWidth: 2, borderColor: colors.primary, padding: 14 },
  aiBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primaryTint,
    borderRadius: radius.pill,
    paddingVertical: 3,
    paddingHorizontal: 8,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  legsRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 10, height: 10, borderRadius: 5 },
});
