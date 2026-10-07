import { StyleSheet, View } from 'react-native';

import { ModePill } from '@/components/routly/ModePill';
import { PrimaryButton } from '@/components/routly/PrimaryButton';
import { RText } from '@/components/routly/RText';
import type { WalkingRoute } from '@/services';
import { colors, fonts, radius, shadows } from '@/theme/routly';

import { formatDistance, formatDuration } from '../../trip/format';

interface WalkingOptionCardProps {
  route: WalkingRoute;
  onStart: () => void;
}

/** The walking option on Routes: time, distance, main roads, safety notes. */
export function WalkingOptionCard({ route, onStart }: WalkingOptionCardProps) {
  const { via, warnings, safety } = route;
  return (
    <View
      style={[styles.card, shadows.selectedCard]}
      accessible
      accessibilityLabel={`Walking, ${formatDuration(route.durationSec)}, ${formatDistance(route.distanceMeters)}${via ? `, via ${via}` : ''}`}
    >
      <View style={styles.row}>
        <RText variant="bigNumber">{formatDuration(route.durationSec)}</RText>
        <RText variant="price">{formatDistance(route.distanceMeters)}</RText>
      </View>
      <View style={styles.legs}>
        <ModePill mode="walk" label="Walk" />
        {!!via && (
          <RText variant="caption" numberOfLines={2} style={styles.flex}>
            via {via}
          </RText>
        )}
      </View>
      {(safety.notes.length > 0 || warnings.length > 0) && (
        <View style={styles.notes}>
          {safety.notes.map((note) => (
            <RText key={note} variant="caption" color={colors.primary}>
              {note}
            </RText>
          ))}
          {warnings.map((w) => (
            <RText key={w} variant="caption" color={colors.traffic.textModerate}>
              ⚠ {w}
            </RText>
          ))}
        </View>
      )}
      <View style={styles.footer}>
        <Stat label="Cost" value="Free" />
        <Stat label="Transfers" value="Direct" />
        <Stat label="Time of day" value={safety.night ? 'Night' : 'Day'} />
      </View>
      <PrimaryButton
        label="Start walking"
        trailingIcon="arrow-right"
        height={48}
        onPress={onStart}
      />
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <RText variant="small">{label}</RText>
      <RText variant="body" family={fonts.bold}>
        {value}
      </RText>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 2,
    borderColor: colors.primary,
    padding: 16,
    gap: 12,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  legs: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  flex: { flex: 1 },
  notes: { gap: 4 },
  footer: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 12,
  },
  stat: { flex: 1, gap: 2 },
});
