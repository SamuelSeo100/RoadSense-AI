import { StyleSheet, View } from 'react-native';

import { Icon, modeIcon } from '@/components/routly/Icon';
import { RText } from '@/components/routly/RText';
import { colors, fonts, modeColors, shadows, type Mode } from '@/theme/routly';

/**
 * At each leg change: a small circle in the next leg's colour with its mode
 * icon. Fixed-size box (Android snapshots markers at their root size).
 */
export function LegBadge({ mode }: { mode: Mode }) {
  return (
    <View style={styles.legBox} collapsable={false}>
      <View style={[styles.legBadge, { backgroundColor: modeColors[mode].line }]}>
        <Icon name={modeIcon[mode]} size={12} color={colors.textOnPrimary} strokeWidth={2.4} />
      </View>
    </View>
  );
}

/** Where the trip starts: a green ring. */
export function StartMarker() {
  return (
    <View style={styles.legBox} collapsable={false}>
      <View style={styles.startRing} />
    </View>
  );
}

/** Red destination pin with the place-name chip above it. */
export function DestinationPin({ name }: { name: string }) {
  return (
    <View style={styles.markerBox}>
      <View style={styles.labelChip}>
        <RText variant="body" size={12} family={fonts.bold} numberOfLines={1}>
          {name}
        </RText>
      </View>
      <View style={styles.pinHead} />
      <View style={styles.pinStem} />
    </View>
  );
}

/**
 * Android snapshots custom markers to a bitmap sized from the root view, so
 * give label + pin markers a fixed box (content bottom-centred) or the lower
 * part gets clipped.
 */
export const MARKER_BOX = { width: 160, height: 84 };
/** Leg badges and the start ring. */
const SMALL_BOX = 30;

const styles = StyleSheet.create({
  markerBox: { ...MARKER_BOX, alignItems: 'center', justifyContent: 'flex-end' },
  labelChip: {
    maxWidth: MARKER_BOX.width - 8,
    backgroundColor: colors.surface,
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginBottom: 6,
    ...shadows.mapControl,
  },
  legBox: { width: SMALL_BOX, height: SMALL_BOX, alignItems: 'center', justifyContent: 'center' },
  legBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  startRing: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 5,
    borderColor: modeColors.metro.line,
    backgroundColor: colors.surface,
  },
  pinHead: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.destination,
    borderWidth: 3,
    borderColor: colors.surface,
  },
  pinStem: { width: 3, height: 8, backgroundColor: colors.destination, marginTop: -1 },
});
