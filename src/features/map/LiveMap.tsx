import Constants, { ExecutionEnvironment } from 'expo-constants';
import { useEffect, useMemo, useRef, useState } from 'react';
import { PixelRatio, Platform, StyleSheet } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE, Polyline, type LatLng } from 'react-native-maps';

import { fallbackOrigin } from '@/services';
import { modeColors } from '@/theme/routly';

import { DestinationPin, ModeBadge, TransferDot } from './MapMarkers';
import { mapStyle, tint } from './mapStyle';
import type { MapContent } from './mapStore';

export interface LiveMapProps {
  content: MapContent | undefined;
  userLocation: LatLng | null;
  /** Visible map area: below the top bar, above the sheet at peek. */
  insets: { top: number; bottom: number };
  satellite: boolean;
  /** Google's live traffic layer (native; it has no opacity setting). */
  traffic: boolean;
  /** Increment to recenter on the user. */
  recenterKey: number;
}

/**
 * Google Maps on both platforms when the SDK key is configured, so Android and
 * iOS render the same. iOS falls back to Apple Maps without a key, and in Expo
 * Go (which doesn't include the Google Maps iOS SDK).
 */
const googleMapsConfigured = Constants.expoConfig?.extra?.googleMapsConfigured === true;
const inExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
const useGoogle = Platform.OS === 'android' || (googleMapsConfigured && !inExpoGo);

/**
 * Routes are solid (opaque) but faint, so the live traffic lines stay legible
 * on top: the selected route is the mode colour lightened 35%, alternatives 75%.
 */
const ROUTE_TINT = 0.35;
const FADED_TINT = 0.75;
const EDGE = 40;
/** Half-span (degrees) of the box kept around the user when centring on them. */
const USER_SPAN = 0.006;

/**
 * Walk legs are dotted. Android turns pattern items into true dots when the
 * cap is round (gap in px); iOS gets short dashes with round caps (points).
 */
const WALK_PATTERN = Platform.OS === 'android' ? [1, 9 * PixelRatio.get()] : [1, 9];

const userBox = (p: LatLng): LatLng[] => [
  { latitude: p.latitude + USER_SPAN, longitude: p.longitude + USER_SPAN },
  { latitude: p.latitude - USER_SPAN, longitude: p.longitude - USER_SPAN },
];

/**
 * Custom marker views are snapshotted on Android. Let them render for a moment
 * after each change, then stop tracking (keeps panning smooth).
 */
function useTracksViewChanges(dep: string) {
  const [settled, setSettled] = useState<string | null>(null);
  useEffect(() => {
    const t = setTimeout(() => setSettled(dep), 600);
    return () => clearTimeout(t);
  }, [dep]);
  return settled !== dep;
}

/** The shared live map (react-native-maps, Google provider, live traffic layer). */
export function LiveMap({
  content,
  userLocation,
  insets,
  satellite,
  traffic,
  recenterKey,
}: LiveMapProps) {
  const mapRef = useRef<MapView>(null);
  const [ready, setReady] = useState(false);
  const origin = userLocation ?? fallbackOrigin.location;
  const hasFix = userLocation !== null;
  const selection = content?.selection ?? 'none';
  const focused = content?.focused === true && selection !== 'none';
  const routes = useMemo(
    () => (selection === 'none' ? [] : (content?.routes ?? [])),
    [content, selection],
  );
  const tracks = useTracksViewChanges(`${selection}|${routes.map((r) => r.id).join()}`);

  // Selected route drawn last, so it sits on top of the faded alternatives.
  const ordered = useMemo(
    () => [...routes].sort((a, b) => Number(a.id === selection) - Number(b.id === selection)),
    [routes, selection],
  );

  /**
   * Camera: centred on the user by default; frames the selected route only
   * once the user has picked something (`content.focused`). It moves only when
   * what it should frame changes, so GPS jitter never yanks the map.
   */
  const lastCamera = useRef<string | null>(null);
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    const edgePadding = {
      top: insets.top + 72,
      bottom: insets.bottom + 24,
      left: EDGE,
      right: EDGE,
    };
    const picked = selection === 'all' ? routes : routes.filter((r) => r.id === selection);
    const coords = focused ? picked.flatMap((r) => r.legs.flatMap((l) => l.polyline ?? [])) : [];
    const first = coords[0];
    const last = coords[coords.length - 1];
    const frame = `${insets.top}:${insets.bottom}`;
    const key =
      first && last && coords.length > 1
        ? `route:${selection}:${first.latitude},${first.longitude}:${last.latitude},${last.longitude}:${frame}`
        : `user:${hasFix}:${frame}`;
    if (key === lastCamera.current) return;
    lastCamera.current = key;
    map.fitToCoordinates(coords.length > 1 ? coords : userBox(origin), {
      edgePadding,
      animated: true,
    });
    // `origin` is left out on purpose: GPS updates shouldn't move the camera.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, focused, selection, routes, hasFix, insets.top, insets.bottom]);

  // Recenter button: centre on the user, keeping the dot inside the visible area.
  useEffect(() => {
    if (!ready || recenterKey === 0 || !mapRef.current) return;
    mapRef.current.fitToCoordinates(userBox(origin), {
      edgePadding: { top: insets.top + 72, bottom: insets.bottom + 24, left: EDGE, right: EDGE },
      animated: true,
    });
    // Only on button presses.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recenterKey]);

  return (
    <MapView
      ref={mapRef}
      style={StyleSheet.absoluteFill}
      provider={useGoogle ? PROVIDER_GOOGLE : undefined}
      customMapStyle={useGoogle && !satellite ? mapStyle : undefined}
      mapType={satellite ? 'hybrid' : 'standard'}
      showsTraffic={traffic}
      // Native location dot: drawn by the map engine (no marker snapshots,
      // smooth updates, no JS work per GPS fix).
      showsUserLocation={hasFix}
      showsCompass={false}
      showsMyLocationButton={false}
      showsPointsOfInterests={false}
      toolbarEnabled={false}
      onMapReady={() => setReady(true)}
      initialRegion={{ ...origin, latitudeDelta: 0.12, longitudeDelta: 0.12 }}
      accessibilityLabel="Live map"
    >
      {ordered.map((route) => {
        const highlighted = selection === 'all' || route.id === selection;
        const lighten = highlighted ? ROUTE_TINT : FADED_TINT;
        return route.legs.map((leg, i) => {
          if (!leg.polyline || leg.polyline.length < 2) return null;
          const walk = leg.mode === 'walk';
          return (
            <Polyline
              // Pattern changes don't always re-apply natively: remount per style.
              key={`${route.id}-${i}-${walk ? 'dot' : 'solid'}`}
              coordinates={leg.polyline}
              strokeColor={tint(modeColors[leg.mode].line, walk ? 0 : lighten)}
              strokeWidth={6}
              // Butt caps: solid legs meet end to end without darker overlap dots.
              lineCap={walk ? 'round' : 'butt'}
              lineJoin="round"
              lineDashPattern={walk ? WALK_PATTERN : undefined}
              zIndex={highlighted ? 2 : 1}
            />
          );
        });
      })}

      {ordered
        .filter((r) => !content?.plain && (selection === 'all' || r.id === selection))
        .flatMap((route) =>
          // Transfer points: where one leg hands over to the next.
          route.legs.slice(1).map((leg, i) => {
            const at = leg.polyline?.[0];
            return at ? (
              <Marker
                key={`transfer-${route.id}-${i}`}
                coordinate={at}
                anchor={{ x: 0.5, y: 0.5 }}
                tracksViewChanges={tracks}
                zIndex={3}
              >
                <TransferDot mode={leg.mode} />
              </Marker>
            ) : null;
          }),
        )}

      {ordered
        .filter((r) => !content?.plain && (selection === 'all' || r.id === selection))
        .flatMap((route) =>
          route.legs.map((leg, i) => {
            // Walk legs are recognisable by their dots; badges only for rides.
            if (leg.mode === 'walk') return null;
            const mid = leg.polyline?.[Math.floor(leg.polyline.length / 2)];
            return mid ? (
              <Marker
                key={`badge-${route.id}-${i}`}
                coordinate={mid}
                anchor={{ x: 0.5, y: 0.5 }}
                tracksViewChanges={tracks}
                zIndex={3}
              >
                <ModeBadge mode={leg.mode} />
              </Marker>
            ) : null;
          }),
        )}

      {content?.destination && selection !== 'none' && (
        <Marker
          // Remount per destination: a fresh snapshot instead of a re-layout.
          key={content.destination.name}
          coordinate={content.destination.location}
          anchor={{ x: 0.5, y: 1 }}
          tracksViewChanges={tracks}
          zIndex={4}
          accessibilityLabel={`Destination: ${content.destination.name}`}
        >
          <DestinationPin name={content.destination.name} />
        </Marker>
      )}
    </MapView>
  );
}
