import { StyleSheet, View } from 'react-native';

import { RText } from '@/components/routly/RText';
import type { MonthlyStats } from '@/services';
import { colors, fonts, modeColors, radius, type Mode } from '@/theme/routly';

const modeLabel: Record<Mode, string> = {
  walk: 'Walk',
  metro: 'Metro',
  bus: 'Bus',
  auto: 'Auto',
  cab: 'Cab',
  bike: 'Bike taxi',
  cycle: 'Cycle',
  train: 'Train',
};

/** "How you travel": proportional stacked bar + legend. */
export function ModeMixCard({ mix }: { mix: MonthlyStats['modeMix'] }) {
  const summary = mix.map((m) => `${modeLabel[m.mode]} ${m.percent}%`).join(', ');
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <RText variant="body" family={fonts.extrabold} accessibilityRole="header">
          How you travel
        </RText>
        <View style={styles.badge}>
          <RText variant="badge" color={colors.primary}>
            Used by AI ranking
          </RText>
        </View>
      </View>
      <View style={styles.bar} accessible accessibilityLabel={`Mode mix: ${summary}`}>
        {mix.map((m) => (
          <View
            key={m.mode}
            style={{ flex: m.percent, backgroundColor: modeColors[m.mode].line }}
          />
        ))}
      </View>
      <View
        style={styles.legend}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        {mix.map((m) => (
          <View key={m.mode} style={styles.legendItem}>
            <View style={[styles.dot, { backgroundColor: modeColors[m.mode].line }]} />
            <RText variant="body" size={12} family={fonts.bold}>
              {modeLabel[m.mode]} {m.percent}%
            </RText>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.cardSm,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 10,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  badge: {
    backgroundColor: colors.primaryTint,
    borderRadius: radius.pill,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  bar: { flexDirection: 'row', height: 12, borderRadius: 6, overflow: 'hidden', gap: 2 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
