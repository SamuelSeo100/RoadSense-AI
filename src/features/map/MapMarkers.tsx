import { StyleSheet, View } from 'react-native';

import { Icon, modeIcon } from '@/components/routly/Icon';
import { RText } from '@/components/routly/RText';
import { colors, fonts, modeColors, shadows, type Mode } from '@/theme/routly';

/** Blue location dot: 15% halo, 3px white ring, plus the "You · {area}" chip. */
export function UserDot({ label }: { label: string }) {
  return (
    <View style={styles.center}>
      <View style={styles.labelChip}>
        <RText variant="body" size={12} family={fonts.bold}>
          {label}
        </RText>
      </View>
      <View style={styles.halo}>
        <View style={styles.dot} />
      </View>
    </View>
  );
}

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
    <View style={styles.center}>
      <View style={styles.labelChip}>
        <RText variant="body" size={12} family={fonts.bold}>
          {name}
        </RText>
      </View>
      <View style={styles.pinHead} />
      <View style={styles.pinStem} />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center' },
  labelChip: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginBottom: 6,
    ...shadows.mapControl,
  },
  halo: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.userLocationHalo,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.userLocation,
    borderWidth: 3,
    borderColor: colors.surface,
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
