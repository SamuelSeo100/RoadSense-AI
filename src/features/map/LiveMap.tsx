import Constants from 'expo-constants';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE, Polyline, type LatLng } from 'react-native-maps';

import { fallbackOrigin } from '@/services';
import { modeColors } from '@/theme/routly';

import { DestinationPin, ModeBadge, UserDot } from './MapMarkers';
import { mapStyle, withAlpha } from './mapStyle';
import type { MapContent } from './mapStore';

export interface LiveMapProps {
  content: MapContent | undefined;
  userLocation: LatLng | null;
  area: string | null;
  /** Visible map area: below the top bar, above the sheet at peek. */
  insets: { top: number; bottom: number };
  satellite: boolean;
  /** Increment to recenter on the user. */
  recenterKey: number;
}

const useGoogle =
  Platform.OS === 'android' || Constants.expoConfig?.extra?.googleMapsOnIos === true;

const FADED = 0.25;
/** Dashed where supported (Android, Apple Maps); solid on Google Maps for iOS. */
const DASH = [11, 9];
const EDGE = 40;

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
  area,
  insets,
  satellite,
  recenterKey,
}: LiveMapProps) {
  const mapRef = useRef<MapView>(null);
  const [ready, setReady] = useState(false);
  const origin = userLocation ?? fallbackOrigin.location;
  const selection = content?.selection ?? 'none';
  const routes = useMemo(
    () => (selection === 'none' ? [] : (content?.routes ?? [])),
    [content, selection],
  );
  const tracks = useTracksViewChanges(`${selection}|${routes.map((r) => r.id).join()}|${area}`);

  // Selected route drawn last, so it sits on top of the faded alternatives.
  const ordered = useMemo(
    () => [...routes].sort((a, b) => Number(a.id === selection) - Number(b.id === selection)),
    [routes, selection],
  );

  // Fit the camera to the selected route inside the visible map area.
  useEffect(() => {
    if (!ready || !mapRef.current) return;
    const focus = selection === 'all' ? routes : routes.filter((r) => r.id === selection);
    const coords = focus.flatMap((r) => r.legs.flatMap((l) => l.polyline ?? []));
    const edgePadding = {
      top: insets.top + 60,
      bottom: insets.bottom + 24,
      left: EDGE,
      right: EDGE,
    };
    if (coords.length > 1) {
      mapRef.current.fitToCoordinates(coords, { edgePadding, animated: true });
    } else {
      mapRef.current.fitToCoordinates(
        [
          { latitude: origin.latitude + 0.01, longitude: origin.longitude + 0.01 },
          { latitude: origin.latitude - 0.01, longitude: origin.longitude - 0.01 },
        ],
        { edgePadding, animated: true },
      );
    }
    // `origin` is left out on purpose: GPS updates shouldn't yank the camera.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, routes, selection, insets.top, insets.bottom]);

  // Recenter button: centre on the user, keeping the dot inside the visible area.
  useEffect(() => {
    if (!ready || recenterKey === 0 || !mapRef.current) return;
    mapRef.current.fitToCoordinates(
      [
        { latitude: origin.latitude + 0.006, longitude: origin.longitude + 0.006 },
        { latitude: origin.latitude - 0.006, longitude: origin.longitude - 0.006 },
      ],
      {
        edgePadding: { top: insets.top + 60, bottom: insets.bottom + 24, left: EDGE, right: EDGE },
        animated: true,
      },
    );
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
      showsTraffic
      showsCompass={false}
      showsMyLocationButton={false}
      showsPointsOfInterests={false}
      toolbarEnabled={false}
      onMapReady={() => setReady(true)}
      initialRegion={{ ...origin, latitudeDelta: 0.12, longitudeDelta: 0.12 }}
      accessibilityLabel="Live map"
    >
      {ordered.map((route) => {
        const opacity = selection === 'all' || route.id === selection ? 1 : FADED;
        return route.legs.map((leg, i) =>
          leg.polyline && leg.polyline.length > 1 ? (
            <Polyline
              key={`${route.id}-${i}`}
              coordinates={leg.polyline}
              strokeColor={withAlpha(modeColors[leg.mode].line, opacity)}
              strokeWidth={6}
              lineDashPattern={DASH}
              lineCap="round"
              zIndex={opacity === 1 ? 2 : 1}
            />
          ) : null,
        );
      })}

      {ordered
        .filter((r) => selection === 'all' || r.id === selection)
        .flatMap((route) =>
          route.legs.map((leg, i) => {
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
          coordinate={content.destination.location}
          anchor={{ x: 0.5, y: 1 }}
          tracksViewChanges={tracks}
          zIndex={4}
          accessibilityLabel={`Destination: ${content.destination.name}`}
        >
          <DestinationPin name={content.destination.name} />
        </Marker>
      )}

      <Marker
        coordinate={origin}
        anchor={{ x: 0.5, y: 0.85 }}
        tracksViewChanges={tracks}
        zIndex={5}
        accessibilityLabel="Your location"
      >
        <UserDot label={`You · ${area ?? fallbackOrigin.name}`} />
      </Marker>
    </MapView>
  );
}
