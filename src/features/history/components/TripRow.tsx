import { Pressable, StyleSheet, View } from 'react-native';

import { Icon, modeIcon } from '@/components/routly/Icon';
import { formatInr } from '@/components/routly/routeFormat';
import { RText } from '@/components/routly/RText';
import type { Trip } from '@/services';
import { colors, fonts, modeColors, radius } from '@/theme/routly';

interface TripRowProps {
  trip: Trip;
  selected: boolean;
  onPress: () => void;
  onRepeat: () => void;
}

/** A past trip. Tap to show it on the map; Repeat plans it again. */
export function TripRow({ trip, selected, onPress, onRepeat }: TripRowProps) {
  const c = modeColors[trip.mode];
  return (
    <View style={[styles.row, selected ? styles.selected : styles.unselected]}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityState={{ selected }}
        accessibilityLabel={`${trip.from} to ${trip.to}, ${trip.startTime}, ${trip.modeLabel}, ${trip.durationMin} minutes, ${formatInr(trip.costInr)}`}
        accessibilityHint="Shows this trip on the map"
        style={styles.main}
      >
        <View style={[styles.badge, { backgroundColor: c.pillBg }]}>
          <Icon name={modeIcon[trip.mode]} size={20} color={c.pillText} />
        </View>
        <View style={styles.text}>
          <RText variant="body" family={fonts.extrabold} numberOfLines={1}>
            {trip.from} → {trip.to}
          </RText>
          <RText variant="caption" numberOfLines={1}>
            {trip.startTime} · {trip.modeLabel} · {trip.durationMin} min
          </RText>
        </View>
      </Pressable>
      <View style={styles.right}>
        <RText variant="body" family={fonts.extrabold}>
          {formatInr(trip.costInr)}
        </RText>
        <Pressable
          onPress={onRepeat}
          accessibilityRole="button"
          accessibilityLabel={`Repeat trip from ${trip.from} to ${trip.to}`}
          hitSlop={{ top: 8, bottom: 12, left: 12, right: 12 }}
        >
          <RText variant="small" family={fonts.extrabold} color={colors.primary}>
            Repeat
          </RText>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.tile,
    gap: 12,
  },
  unselected: { borderWidth: 1, borderColor: colors.border, padding: 13 },
  selected: { borderWidth: 2, borderColor: colors.primary, padding: 12 },
  main: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44 },
  badge: {
    width: 40,
    height: 40,
    borderRadius: radius.tileSm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { flex: 1, minWidth: 0, gap: 2 },
  right: { alignItems: 'flex-end', gap: 4 },
});
