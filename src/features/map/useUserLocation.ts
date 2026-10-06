import { useCallback, useEffect } from 'react';
import { Linking } from 'react-native';

import { locationService } from '@/services';

import { useMapStore } from './mapStore';

/**
 * Asks for location once (when the signed-in shell mounts), then streams
 * position updates into the map store. Returns `retry`, which asks again or,
 * if the OS won't show the prompt any more, opens the app's settings.
 */
export function useUserLocation() {
  const status = useMapStore((s) => s.locationStatus);
  const setStatus = useMapStore((s) => s.setLocationStatus);
  const setUserLocation = useMapStore((s) => s.setUserLocation);
  const setArea = useMapStore((s) => s.setArea);

  const request = useCallback(async () => {
    try {
      setStatus(await locationService.requestPermission());
    } catch {
      setStatus('denied');
    }
  }, [setStatus]);

  useEffect(() => {
    request();
  }, [request]);

  useEffect(() => {
    if (status !== 'granted') return;
    let areaLooked = false;
    return locationService.watch((pos) => {
      setUserLocation(pos);
      if (!areaLooked) {
        areaLooked = true;
        locationService.areaName(pos).then(setArea);
      }
    });
  }, [status, setArea, setUserLocation]);

  const retry = useCallback(async () => {
    const result = await locationService.requestPermission().catch(() => 'denied' as const);
    setStatus(result);
    if (result === 'denied') Linking.openSettings();
  }, [setStatus]);

  return { status, retry };
}
