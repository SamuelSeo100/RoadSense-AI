import { StyleSheet, View } from 'react-native';

import { Icon, modeIcon } from '@/components/routly/Icon';
import { RText } from '@/components/routly/RText';
import { colors, fonts, modeColors, shadows, type Mode } from '@/theme/routly';

/** 36px mode-coloured circle with a white icon and a 3px white ring. */
export function ModeBadge({ mode }: { mode: Mode }) {
  return (
    <View style={[styles.badge, { backgroundColor: modeColors[mode].line }]}>
      <Icon name={modeIcon[mode]} size={16} color={colors.textOnPrimary} strokeWidth={2.2} />
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
export const MARKER_BOX = { width: 200, height: 84 };

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
  badge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 3,
    borderColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
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
