import { Pressable, StyleSheet, View } from 'react-native';

import { Icon, type IconName } from '@/components/routly/Icon';
import { RText } from '@/components/routly/RText';
import { SectionHeader } from '@/components/routly/SectionHeader';
import { colors, fonts, modeColors, radius, type Mode } from '@/theme/routly';

export type TicketTile = 'metro' | 'bus' | 'cab' | 'bike';

const tiles: { id: TicketTile; label: string; icon: IconName; mode: Mode }[] = [
  { id: 'metro', label: 'Metro', icon: 'metro', mode: 'metro' },
  { id: 'bus', label: 'Bus pass', icon: 'bus', mode: 'bus' },
  { id: 'cab', label: 'Uber / Ola', icon: 'cab', mode: 'cab' },
  { id: 'bike', label: 'Bike taxi', icon: 'bike', mode: 'bike' },
];

/** Tickets & rides: each tile redirects to the partner app or site. */
export function TicketsGrid({ onPress }: { onPress: (tile: TicketTile) => void }) {
  return (
    <View style={styles.section}>
      <SectionHeader title="Tickets & rides" />
      <View style={styles.grid}>
        {tiles.map((t) => (
          <Pressable
            key={t.id}
            onPress={() => onPress(t.id)}
            accessibilityRole="link"
            accessibilityLabel={`${t.label}, opens the partner app`}
            style={({ pressed }) => [styles.tile, pressed && styles.pressed]}
          >
            <View style={[styles.chip, { backgroundColor: modeColors[t.mode].pillBg }]}>
              <Icon name={t.icon} size={20} color={modeColors[t.mode].pillText} />
            </View>
            <RText variant="small" family={fonts.bold} color={colors.textPrimary} numberOfLines={1}>
              {t.label}
            </RText>
          </Pressable>
        ))}
      </View>
      <RText variant="small">Cab and bike bookings open in the partner app.</RText>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 10 },
  grid: { flexDirection: 'row', gap: 8 },
  tile: {
    flex: 1,
    minHeight: 84,
    borderRadius: radius.tile,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 4,
  },
  pressed: { backgroundColor: colors.background },
  chip: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
});
