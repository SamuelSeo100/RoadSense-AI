import { useEffect, useMemo } from 'react';

import { savedPlacesService, type Place, type SavedPlace } from '@/services';
import { useAuthStore } from '@/store/authStore';
import { useRoutlyPrefs } from '@/store/routlyPrefsStore';

/** Always listed (set or not), in this order. */
export const FIXED_LABELS = ['Home', 'College', 'Work'] as const;
export type FixedLabel = (typeof FIXED_LABELS)[number];
export const MAX_CUSTOM_PLACES = 5;
export const MAX_LABEL_LENGTH = 40;

export const isFixedLabel = (label: string): label is FixedLabel =>
  (FIXED_LABELS as readonly string[]).includes(label);

/** A saved place with its address (unset fixed labels have none). */
export type SetPlace = SavedPlace & { place: Place };
export const isSet = (sp: SavedPlace): sp is SetPlace => sp.place !== undefined;

/** Words that mean a fixed label, in English, Hindi and Marathi ("ghar", "office"). */
const ALIASES: Record<string, FixedLabel> = {
  home: 'Home',
  house: 'Home',
  ghar: 'Home',
  ghari: 'Home',
  college: 'College',
  collage: 'College',
  campus: 'College',
  work: 'Work',
  office: 'Work',
  workplace: 'Work',
};

const normalise = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^(my|the|mera|meri|maza|mazha|majha)\s+/, '');

/** Home, College, Work (set or not), then the custom places. */
export function savedPlacesList(stored: SavedPlace[]): SavedPlace[] {
  const set = stored.filter(isSet);
  const fixed = FIXED_LABELS.map(
    (label): SavedPlace => set.find((p) => p.label === label) ?? { id: label.toLowerCase(), label },
  );
  return [...fixed, ...set.filter((p) => !isFixedLabel(p.label))];
}

/** The device mirror, if it belongs to the signed-in user. */
function storedPlaces(): SavedPlace[] {
  const prefs = useRoutlyPrefs.getState().prefs;
  if (!prefs) return [];
  const userId = useAuthStore.getState().user?.id ?? null;
  // Mock-auth keeps everything local; there's only ever one "user".
  if (savedPlacesService && prefs.savedPlacesOwner !== userId) return [];
  return prefs.savedPlaces;
}

/** Saved places in display order, outside React. */
export const currentSavedPlaces = () => savedPlacesList(storedPlaces());

/** Saved places in display order (fixed labels first). */
export function useSavedPlaces(): SavedPlace[] {
  const prefs = useRoutlyPrefs((s) => s.prefs);
  const userId = useAuthStore((s) => s.user?.id ?? null);
  return useMemo(() => {
    if (!prefs) return savedPlacesList([]);
    const mine = !savedPlacesService || prefs.savedPlacesOwner === userId;
    return savedPlacesList(mine ? prefs.savedPlaces : []);
  }, [prefs, userId]);
}

/**
 * The saved place a word refers to: "home", "ghar", "college", "office",
 * "work", or a custom label ("Gym"). `place` is missing when the label isn't
 * set yet. Null when the text isn't a saved-place word.
 */
export function savedPlaceFor(text: string): SavedPlace | null {
  const words = normalise(text);
  if (!words) return null;
  const list = savedPlacesList(storedPlaces());
  const fixed = ALIASES[words];
  if (fixed) return list.find((p) => p.label === fixed) ?? null;
  return list.find((p) => normalise(p.label) === words) ?? null;
}

const write = (savedPlaces: SavedPlace[]) =>
  useRoutlyPrefs.getState().update({
    savedPlaces,
    savedPlacesOwner: useAuthStore.getState().user?.id ?? null,
  });

/**
 * Sets (or moves) the place for `label`. `previousLabel` renames a custom
 * place. Applies on the device at once; reverts and throws if the server
 * rejects it.
 */
export async function setSavedPlace(label: string, place: Place, previousLabel?: string) {
  await useRoutlyPrefs.getState().hydrate();
  const before = storedPlaces();
  const entry: SetPlace = { id: label.toLowerCase(), label, place };
  // The entry being edited keeps its position; a new one goes last.
  const key = previousLabel ?? label;
  const others = before.filter((p) => p.label !== label || p.label === key);
  write(
    others.some((p) => p.label === key)
      ? others.map((p) => (p.label === key ? entry : p))
      : [...others, entry],
  );
  try {
    await savedPlacesService?.save(label, place);
    if (previousLabel && previousLabel !== label) await savedPlacesService?.remove(previousLabel);
  } catch (e) {
    write(before);
    throw e;
  }
}

export async function removeSavedPlace(label: string) {
  await useRoutlyPrefs.getState().hydrate();
  const before = storedPlaces();
  write(before.filter((p) => p.label !== label));
  try {
    await savedPlacesService?.remove(label);
  } catch (e) {
    write(before);
    throw e;
  }
}

/** Replaces the device mirror with the server copy (no-op in mock-auth mode or offline). */
async function syncSavedPlaces(userId: string) {
  if (!savedPlacesService) return;
  await useRoutlyPrefs.getState().hydrate();
  try {
    const places = await savedPlacesService.list();
    if (useAuthStore.getState().user?.id !== userId) return;
    useRoutlyPrefs.getState().update({ savedPlaces: places, savedPlacesOwner: userId });
  } catch {
    // Offline: keep the mirror (it's only used if it's this user's).
  }
}

/** Mount once in the signed-in shell: pulls the server copy on sign-in. */
export function useSavedPlacesSync() {
  const userId = useAuthStore((s) => s.user?.id ?? null);
  useEffect(() => {
    if (userId) void syncSavedPlaces(userId);
  }, [userId]);
}
