import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect } from 'react';

import type { TripTrackRow } from '@/navigation/tripTrack';
import { tripLogService } from '@/services';
import { useAuthStore } from '@/store/authStore';

import { useNavigationStore } from './navigationStore';

/**
 * The trip in progress, saved as the row it would be if the app died now
 * (end_reason 'abandoned'). A clean end removes it; otherwise the next app
 * start submits it, so killed trips still reach trip_tracks.
 */
const KEY = 'routly.navigation.active.v1';

interface Snapshot {
  userId: string;
  row: TripTrackRow;
}

let writing: Promise<unknown> = Promise.resolve();
const serial = (op: () => Promise<unknown>) => {
  writing = writing.then(op).catch(() => {});
  return writing;
};

export const saveActiveTrip = (userId: string, row: TripTrackRow) =>
  serial(() => AsyncStorage.setItem(KEY, JSON.stringify({ userId, row } satisfies Snapshot)));

export const clearActiveTrip = () => serial(() => AsyncStorage.removeItem(KEY));

/** Submits a trip left over from a killed session (same user only), then forgets it. */
export async function recoverAbandonedTrip(userId: string | null) {
  await writing;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return;
    const snap = JSON.parse(raw) as Snapshot;
    // Another account: keep it for when its owner signs in again.
    if (!userId || snap.userId !== userId) return;
    if (snap.row?.trip_id) tripLogService.logTripTrack(snap.row);
  } catch {
    // Unreadable snapshot: drop it.
  }
  await clearActiveTrip();
}

/** Once per signed-in session: a trip the app was killed on goes to trip_tracks as abandoned. */
export function useRecoverAbandonedTrip() {
  const userId = useAuthStore((s) => s.user?.id ?? null);
  useEffect(() => {
    if (userId && !useNavigationStore.getState().active) void recoverAbandonedTrip(userId);
  }, [userId]);
}
