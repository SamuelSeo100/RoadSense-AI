import { useEffect, useRef, useState } from 'react';
import { PixelRatio, Platform, StyleSheet, View } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE, Polyline } from 'react-native-maps';

import type { NavStep } from '@/navigation/steps';
import type { LatLng } from '@/services';
import { colors, modeColors } from '@/theme/routly';

import { googleMaps } from '../../map/LiveMap';
import { DestinationPin } from '../../map/MapMarkers';
import { mapStyle } from '../../map/mapStyle';

export interface NavigationMapProps {
  position: LatLng | null;
  heading: number | null;
  /** The whole route (drawn faint underneath what's left). */
  steps: readonly NavStep[];
  /** Leg in progress: its remaining path is drawn wider. */
  currentLeg: number | null;
  /** Demo replay: the fake position gets its own marker (the real GPS dot is hidden). */
  simulated: boolean;
  /** Remaining path per step, current step first. */
  paths: { step: NavStep; path: LatLng[] }[];
  destination: { name: string; location: LatLng };
  /** Camera follows the user (heading up) until they pan. */
  follow: boolean;
  onPan: () => void;
  /** Zoomed out while riding (trains cover kilometres per minute). */
  riding: boolean;
  /** Visible area between the instruction card and the bottom panel. */
  insets: { top: number; bottom: number };
}

const px = (dp: number) => (Platform.OS === 'android' ? dp * PixelRatio.get() : dp);
const WALK_PATTERN = [1, px(6)];

function lineColor(step: NavStep): string {
  return step.transit?.lineColor ?? modeColors[step.legMode].line;
}

/** Follow-mode map for navigation: only what's left of the trip is drawn. */
export function NavigationMap({
  position,
  heading,
  steps,
  currentLeg,
  simulated,
  paths,
  destination,
  follow,
  onPan,
  riding,
  insets,
}: NavigationMapProps) {
  const mapRef = useRef<MapView>(null);
  const [ready, setReady] = useState(false);
  const start = position ?? paths[0]?.path[0] ?? destination.location;

  useEffect(() => {
    if (!ready || !follow || !position || !mapRef.current) return;
    mapRef.current.animateCamera(
      {
        center: position,
        heading: heading ?? 0,
        pitch: riding ? 0 : 45,
        zoom: riding ? 14 : 17.5,
      },
      { duration: 700 },
    );
  }, [ready, follow, position, heading, riding]);

  return (
    <MapView
      ref={mapRef}
      style={StyleSheet.absoluteFill}
      provider={googleMaps ? PROVIDER_GOOGLE : undefined}
      customMapStyle={googleMaps ? mapStyle : undefined}
      showsUserLocation={!simulated}
      followsUserLocation={false}
      showsCompass={false}
      showsMyLocationButton={false}
      showsPointsOfInterests={false}
      toolbarEnabled={false}
      // Only once the map is ready: react-native-maps (Android) calls GoogleMap.setPadding on a
      // null map for a padding change before then, and the crash blanks the whole screen.
      mapPadding={ready ? { top: insets.top, bottom: insets.bottom, left: 0, right: 0 } : undefined}
      onMapReady={() => setReady(true)}
      onPanDrag={onPan}
      initialCamera={{ center: start, heading: 0, pitch: 0, zoom: 16, altitude: 1000 }}
      accessibilityLabel="Navigation map"
    >
      {steps.map((step) =>
        step.polyline.length < 2 ? null : (
          <Polyline
            key={`${step.id}-full`}
            coordinates={step.polyline}
            strokeColor={colors.borderStrong}
            strokeWidth={4}
            lineCap="round"
            lineJoin="round"
            zIndex={0}
          />
        ),
      )}
      {paths.map(({ step, path }, i) => {
        if (path.length < 2) return null;
        const current = step.legIndex === currentLeg;
        if (step.kind === 'walk') {
          return (
            <Polyline
              key={`${step.id}-walk`}
              coordinates={path}
              strokeColor={modeColors.walk.line}
              strokeWidth={current ? 7 : 5}
              lineCap="round"
              lineJoin="round"
              lineDashPattern={WALK_PATTERN}
              zIndex={3}
            />
          );
        }
        return [
          <Polyline
            key={`${step.id}-outline`}
            coordinates={path}
            strokeColor={colors.surface}
            strokeWidth={current ? 13 : 10}
            lineCap="round"
            lineJoin="round"
            zIndex={i === 0 ? 2 : 1}
          />,
          <Polyline
            key={`${step.id}-solid`}
            coordinates={path}
            strokeColor={lineColor(step)}
            strokeWidth={current ? 9 : 6.5}
            lineCap="round"
            lineJoin="round"
            zIndex={i === 0 ? 2 : 1}
          />,
        ];
      })}
      {simulated && position && (
        <Marker
          coordinate={position}
          anchor={{ x: 0.5, y: 0.5 }}
          tracksViewChanges={false}
          zIndex={5}
          accessibilityLabel="Simulated position"
        >
          <View style={styles.simDot} />
        </Marker>
      )}
      <Marker
        coordinate={destination.location}
        anchor={{ x: 0.5, y: 1 }}
        tracksViewChanges={false}
        zIndex={4}
        accessibilityLabel={`Destination: ${destination.name}`}
      >
        <DestinationPin name={destination.name} />
      </Marker>
    </MapView>
  );
}

const styles = StyleSheet.create({
  simDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 3,
    borderColor: colors.surface,
    backgroundColor: colors.primary,
  },
});
