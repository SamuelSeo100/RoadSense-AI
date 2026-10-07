import { Pressable, StyleSheet, View } from 'react-native';

import { IconButton } from '@/components/routly/IconButton';
import { RText } from '@/components/routly/RText';
import { colors, fonts, radius } from '@/theme/routly';

import type { LocationStatus } from './mapStore';

interface MapOverlaysProps {
  /** Bottom edge of the top bar. */
  top: number;
  locationStatus: LocationStatus;
  onEnableLocation: () => void;
  onRecenter: () => void;
  onLayers: () => void;
  satellite: boolean;
  traffic: boolean;
}

/**
 * Chips and controls floating over the visible part of the map. The traffic
 * colour key lives in Profile › Travel preferences (the ⓘ next to the switch).
 */
export function MapOverlays({
  top,
  locationStatus,
  onEnableLocation,
  onRecenter,
  onLayers,
  satellite,
  traffic,
}: MapOverlaysProps) {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {locationStatus === 'denied' ? (
        <Pressable
          onPress={onEnableLocation}
          accessibilityRole="button"
          accessibilityLabel="Enable location"
          accessibilityHint="Lets Routly plan from where you are"
          style={[styles.livePill, styles.enablePill, { top: top + 12 }]}
        >
          <View style={[styles.liveDot, styles.offDot]} />
          <RText variant="body" size={12} family={fonts.bold} color={colors.textOnPrimary}>
            Enable location
          </RText>
        </Pressable>
      ) : (
        <View style={[styles.livePill, { top: top + 12 }]} accessibilityRole="text">
          <View style={styles.liveHalo}>
            <View style={styles.liveDot} />
          </View>
          <RText variant="body" size={12} family={fonts.bold} color={colors.textOnPrimary}>
            {traffic ? 'Live location · Live traffic' : 'Live location'}
          </RText>
        </View>
      )}

      <View style={[styles.controls, { top: top + 12 }]} pointerEvents="box-none">
        <IconButton
          icon="locate"
          accessibilityLabel="Recenter on my location"
          onPress={onRecenter}
          floating
        />
        <IconButton
          icon="layers"
          accessibilityLabel="Map layers"
          accessibilityState={{ selected: satellite }}
          onPress={onLayers}
          floating
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  livePill: {
    position: 'absolute',
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.textPrimary,
    borderRadius: radius.pill,
    paddingVertical: 7,
    paddingHorizontal: 12,
  },
  enablePill: { minHeight: 44, paddingHorizontal: 14 },
  liveHalo: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.accentHalo,
    alignItems: 'center',
    justifyContent: 'center',
  },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent },
  offDot: { backgroundColor: colors.toggleOff },
  controls: { position: 'absolute', right: 12, gap: 8 },
});
