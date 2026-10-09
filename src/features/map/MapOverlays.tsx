import { Pressable, StyleSheet, View } from 'react-native';

import { IconButton } from '@/components/routly/IconButton';
import { RText } from '@/components/routly/RText';
import { modeNames } from '@/services';
import { colors, fonts, modeColors, radius, type Mode } from '@/theme/routly';

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
  /** Modes of the route on the map, in order (legend chip); empty hides it. */
  legend: Mode[];
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
  legend,
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

      {legend.length > 0 && (
        <View
          style={[styles.legend, { top: top + 60 }]}
          accessible
          accessibilityLabel={`Map key: ${legend.map((m) => modeNames[m]).join(', ')}`}
        >
          {legend.map((mode) => (
            <View key={mode} style={styles.legendItem}>
              {mode === 'walk' ? (
                <View style={styles.walkSwatch}>
                  {[0, 1, 2].map((d) => (
                    <View key={d} style={[styles.dot, { backgroundColor: modeColors.walk.line }]} />
                  ))}
                </View>
              ) : (
                <View style={[styles.lineSwatch, { backgroundColor: modeColors[mode].line }]} />
              )}
              <RText variant="body" size={11} family={fonts.bold}>
                {modeNames[mode]}
              </RText>
            </View>
          ))}
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
  legend: {
    position: 'absolute',
    left: 12,
    maxWidth: 260,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    columnGap: 10,
    rowGap: 4,
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  lineSwatch: { width: 16, height: 5, borderRadius: 3 },
  walkSwatch: { width: 16, flexDirection: 'row', justifyContent: 'space-between' },
  dot: { width: 4, height: 4, borderRadius: 2 },
});
