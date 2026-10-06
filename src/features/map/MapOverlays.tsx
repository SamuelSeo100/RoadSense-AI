import { Pressable, StyleSheet, View } from 'react-native';

import { IconButton } from '@/components/routly/IconButton';
import { RText } from '@/components/routly/RText';
import { colors, fonts, radius, shadows } from '@/theme/routly';

import type { LocationStatus } from './mapStore';

interface MapOverlaysProps {
  /** Bottom edge of the top bar. */
  top: number;
  /** Sheet top at peek, measured from the top of the screen. */
  peekTop: number;
  locationStatus: LocationStatus;
  onEnableLocation: () => void;
  onRecenter: () => void;
  onLayers: () => void;
  satellite: boolean;
}

const trafficLegend = [
  { label: 'Low', color: colors.traffic.low },
  { label: 'Med', color: colors.traffic.medium },
  { label: 'Heavy', color: colors.traffic.heavy },
] as const;

/** Chips and controls floating over the visible part of the map. */
export function MapOverlays({
  top,
  peekTop,
  locationStatus,
  onEnableLocation,
  onRecenter,
  onLayers,
  satellite,
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
            Live location · Live traffic
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

      <View
        style={[styles.legend, { top: peekTop - 12 - LEGEND_HEIGHT }]}
        accessible
        accessibilityLabel="Traffic now: low, medium, heavy"
      >
        <RText variant="fieldLabel" color={colors.textTertiary} style={styles.legendTitle}>
          Traffic now
        </RText>
        <View style={styles.legendRow}>
          {trafficLegend.map((t) => (
            <View key={t.label} style={styles.legendItem}>
              <View style={[styles.legendBar, { backgroundColor: t.color }]} />
              <RText variant="small" size={11} family={fonts.bold} color={colors.textPrimary}>
                {t.label}
              </RText>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

const LEGEND_HEIGHT = 48;

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
    height: LEGEND_HEIGHT,
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.tileSm,
    paddingVertical: 7,
    paddingHorizontal: 10,
    gap: 5,
    ...shadows.mapControl,
  },
  legendTitle: { letterSpacing: 0.3 },
  legendRow: { flexDirection: 'row', gap: 10 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendBar: { width: 12, height: 4, borderRadius: 2 },
});
