import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import MapView, { PROVIDER_GOOGLE } from 'react-native-maps';

import type { LatLng } from '@/services';
import { colors } from '@/theme/routly';

import { googleMaps } from '../map/LiveMap';
import { mapStyle } from '../map/mapStyle';

export interface PinMapProps {
  /** Where the map opens (the pin starts here). */
  initial: LatLng;
  /** The point under the pin, after each pan/zoom ends. */
  onCenterChange: (center: LatLng) => void;
}

/**
 * A small map with a FIXED centre pin: the user pans the map under it (more
 * reliable on Android than dragging a marker). The pin's tip is the centre.
 */
export function PinMap({ initial, onCenterChange }: PinMapProps) {
  // Opens once at `initial`; later changes come from the user panning.
  const [region] = useState(() => ({ ...initial, latitudeDelta: 0.004, longitudeDelta: 0.004 }));
  return (
    <View style={styles.frame}>
      <MapView
        style={StyleSheet.absoluteFill}
        provider={googleMaps ? PROVIDER_GOOGLE : undefined}
        customMapStyle={googleMaps ? mapStyle : undefined}
        initialRegion={region}
        showsPointsOfInterests={false}
        showsCompass={false}
        toolbarEnabled={false}
        rotateEnabled={false}
        pitchEnabled={false}
        onRegionChangeComplete={(r) =>
          onCenterChange({ latitude: r.latitude, longitude: r.longitude })
        }
        accessibilityLabel="Map. Move it to put the pin on the entrance"
      />
      <View style={styles.pinLayer} pointerEvents="none">
        {/* Tip of the stem sits exactly on the map centre. */}
        <View style={styles.pin}>
          <View style={styles.pinHead} />
          <View style={styles.pinStem} />
        </View>
        <View style={styles.shadowDot} />
      </View>
    </View>
  );
}

const PIN_HEAD = 26;
const PIN_STEM = 14;

const styles = StyleSheet.create({
  frame: {
    height: 260,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.map.land,
  },
  pinLayer: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pin: {
    position: 'absolute',
    top: '50%',
    marginTop: -(PIN_HEAD + PIN_STEM),
    alignItems: 'center',
  },
  pinHead: {
    width: PIN_HEAD,
    height: PIN_HEAD,
    borderRadius: PIN_HEAD / 2,
    backgroundColor: colors.destination,
    borderWidth: 4,
    borderColor: colors.surface,
  },
  pinStem: { width: 3, height: PIN_STEM, backgroundColor: colors.destination, marginTop: -1 },
  shadowDot: {
    width: 8,
    height: 4,
    borderRadius: 4,
    backgroundColor: 'rgba(19,32,46,0.35)',
  },
});
