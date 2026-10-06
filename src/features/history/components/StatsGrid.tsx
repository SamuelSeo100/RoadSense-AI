import { StyleSheet, View } from 'react-native';

import { formatInr } from '@/components/routly/routeFormat';
import { RText } from '@/components/routly/RText';
import type { MonthlyStats } from '@/services';
import { colors, fonts, radius } from '@/theme/routly';

/** Trips / Spent / Saved tiles for this month. */
export function StatsGrid({ stats }: { stats: MonthlyStats }) {
  return (
    <View style={styles.grid}>
      <Tile label="Trips" value={String(stats.trips)} caption="this month" />
      <Tile label="Spent" value={formatInr(stats.spentInr)} caption="on travel" />
      <Tile label="Saved" value={formatInr(stats.savedVsCabInr)} caption="vs. cab only" highlight />
    </View>
  );
}

function Tile({
  label,
  value,
  caption,
  highlight,
}: {
  label: string;
  value: string;
  caption: string;
  highlight?: boolean;
}) {
  const tint = highlight ? colors.primary : undefined;
  return (
    <View
      style={[styles.tile, highlight && styles.highlight]}
      accessible
      accessibilityLabel={`${label}: ${value} ${caption}`}
    >
      <RText variant="small" family={fonts.bold} color={tint ?? colors.textSecondary}>
        {label}
      </RText>
      <RText variant="price" color={tint} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </RText>
      <RText variant="small" color={tint}>
        {caption}
      </RText>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', gap: 8 },
  tile: {
    flex: 1,
    borderRadius: radius.tile,
    padding: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 2,
  },
  highlight: { backgroundColor: colors.primaryTint, borderColor: colors.primaryTintBorder },
});
