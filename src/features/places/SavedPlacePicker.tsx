import * as Crypto from 'expo-crypto';
import { useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/routly/Icon';
import { PressableBox } from '@/components/routly/PressableBox';
import { RText } from '@/components/routly/RText';
import { confirm } from '@/lib/confirm';
import {
  fallbackOrigin,
  locationService,
  LocationFixError,
  placesService,
  type Place,
  type PlaceSuggestion,
  type SavedPlace,
} from '@/services';
import { colors, fonts, radius } from '@/theme/routly';

import { useMapStore } from '../map/mapStore';
import { usePlaceAutocomplete } from '../trip/usePlaceAutocomplete';

import { PinConfirm, type PinStart } from './PinConfirm';

import {
  isFixedLabel,
  MAX_LABEL_LENGTH,
  removeSavedPlace,
  setSavedPlace,
  useSavedPlaces,
} from './savedPlaces';

/** What the picker edits: an existing entry (set or not), or a new custom place. */
export type PickerTarget = { kind: 'edit'; entry: SavedPlace } | { kind: 'new' };

interface SavedPlacePickerProps {
  target: PickerTarget | null;
  onClose: () => void;
  /** After a successful save (e.g. Home chips plan the trip right away). */
  onSaved?: (label: string, place: Place) => void;
}

/** A fresh GPS fix; then the confirm step lets the user nudge the pin. */
const FIX_TIMEOUT_MS = 15_000;

type LocateState =
  { status: 'idle' } | { status: 'locating' } | { status: 'denied' } | { status: 'failed' };

const errorMessage = (e: unknown) =>
  e instanceof Error && /limit/i.test(e.message)
    ? 'You can save up to 5 custom places.'
    : 'Couldn’t save. Check your connection and try again.';

/**
 * Full-screen address picker for a saved place: label (custom places only),
 * address search with the same Places autocomplete as the From/To card,
 * delete for places that are set.
 */
export function SavedPlacePicker({ target, onClose, onSaved }: SavedPlacePickerProps) {
  return (
    <Modal
      visible={target !== null}
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
      navigationBarTranslucent
    >
      {target && <PickerBody target={target} onClose={onClose} onSaved={onSaved} />}
    </Modal>
  );
}

function PickerBody({
  target,
  onClose,
  onSaved,
}: SavedPlacePickerProps & { target: PickerTarget }) {
  const insets = useSafeAreaInsets();
  const near = useMapStore((s) => s.userLocation);
  const all = useSavedPlaces();
  const entry = target.kind === 'edit' ? target.entry : null;
  const fixed = entry !== null && isFixedLabel(entry.label);
  const [label, setLabel] = useState(entry?.label ?? '');
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionToken, setSessionToken] = useState(() => Crypto.randomUUID());
  const [locate, setLocate] = useState<LocateState>({ status: 'idle' });
  /** Set → the confirm step (map with a fixed pin) replaces the search. */
  const [pin, setPin] = useState<PinStart | null>(null);
  const { suggestions, loading, failed } = usePlaceAutocomplete(query, {
    enabled: !busy,
    sessionToken,
    near,
  });

  const trimmedLabel = label.trim();
  const labelError = (() => {
    if (fixed) return null;
    if (!trimmedLabel) return 'Give this place a name, like “Gym”.';
    const taken = all.some(
      (p) => p.label.toLowerCase() === trimmedLabel.toLowerCase() && p.label !== entry?.label,
    );
    return taken ? `You already have a place called “${trimmedLabel}”.` : null;
  })();

  const save = async (place: Place) => {
    if (labelError) {
      setError(labelError);
      return;
    }
    const finalLabel = fixed && entry ? entry.label : trimmedLabel;
    setBusy(true);
    try {
      await setSavedPlace(finalLabel, place, entry?.place ? entry.label : undefined);
      onSaved?.(finalLabel, place);
      onClose();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const useMyLocation = async () => {
    Keyboard.dismiss();
    setError(null);
    setLocate({ status: 'locating' });
    try {
      const { position, accuracyM } = await locationService.currentFix({
        timeoutMs: FIX_TIMEOUT_MS,
      });
      const geo = await placesService
        .reverseGeocode(position)
        .catch(() => ({ name: 'Pinned location', placeId: null }));
      setLocate({ status: 'idle' });
      setPin({ center: position, accuracyM, name: geo.name, placeId: geo.placeId });
    } catch (e) {
      setLocate({
        status: e instanceof LocationFixError && e.reason === 'denied' ? 'denied' : 'failed',
      });
    }
  };

  const chooseOnMap = () => {
    Keyboard.dismiss();
    setError(null);
    setLocate({ status: 'idle' });
    const map = useMapStore.getState();
    setPin({
      center: map.mapCenter ?? map.userLocation ?? fallbackOrigin.location,
      accuracyM: null,
    });
  };

  const pick = async (s: PlaceSuggestion) => {
    Keyboard.dismiss();
    if (labelError) {
      setError(labelError);
      return;
    }
    setBusy(true);
    let place: Place;
    try {
      place = await placesService.details(s.placeId, { sessionToken });
    } catch {
      setBusy(false);
      setError('Couldn’t open that place. Try again.');
      return;
    } finally {
      setSessionToken(Crypto.randomUUID());
    }
    await save(place);
  };

  /** Rename only (custom place, address unchanged). */
  const rename = () => {
    if (entry?.place) void save(entry.place);
  };

  const remove = async () => {
    if (!entry?.place) return;
    const ok = await confirm(
      fixed ? `Clear ${entry.label}?` : `Delete ${entry.label}?`,
      fixed
        ? `${entry.label} will no longer point to ${entry.place.name}.`
        : 'This removes the place from your saved places.',
      fixed ? 'Clear' : 'Delete',
    );
    if (!ok) return;
    setBusy(true);
    try {
      await removeSavedPlace(entry.label);
      onClose();
    } catch {
      setError('Couldn’t delete. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  };

  const title = entry
    ? entry.place
      ? `Edit ${entry.label}`
      : `Set ${entry.label}`
    : 'Add a place';
  const renamed = entry?.place !== undefined && !fixed && trimmedLabel !== entry.label;
  const slot = fixed && entry ? entry.label : trimmedLabel;
  const saveLabel = slot ? `Save as ${slot}` : 'Save place';

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 8, paddingBottom: insets.bottom }]}>
      <View style={styles.header}>
        <RText variant="screenTitle" accessibilityRole="header" style={styles.flex}>
          {title}
        </RText>
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close"
          hitSlop={8}
          style={styles.close}
        >
          <Icon name="close" size={22} />
        </Pressable>
      </View>

      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        {!fixed && (
          <View style={styles.field}>
            <RText variant="fieldLabel">Name</RText>
            <TextInput
              value={label}
              onChangeText={(text) => {
                setLabel(text);
                setError(null);
              }}
              placeholder="Gym, Mom’s place…"
              placeholderTextColor={colors.textSecondary}
              maxLength={MAX_LABEL_LENGTH}
              autoFocus={target.kind === 'new'}
              accessibilityLabel="Place name"
              returnKeyType="next"
              style={styles.input}
            />
          </View>
        )}

        {pin ? (
          <PinConfirm
            start={pin}
            saveLabel={saveLabel}
            busy={busy}
            error={error}
            onSave={(place) => void save(place)}
            onBack={() => {
              setPin(null);
              setError(null);
            }}
          />
        ) : (
          <>
            {entry?.place && (
              <View style={styles.current}>
                <Icon name="pin" size={18} color={colors.primary} />
                <View style={styles.flex}>
                  <RText variant="caption">Current address</RText>
                  <RText variant="body" family={fonts.bold} numberOfLines={2}>
                    {entry.place.name}
                  </RText>
                </View>
              </View>
            )}

            <View style={styles.suggestions}>
              <PressableBox
                onPress={useMyLocation}
                disabled={busy || locate.status === 'locating'}
                accessibilityRole="button"
                accessibilityLabel="Use my current location"
                style={[styles.suggestion, styles.optionRow]}
                pressedStyle={styles.pressed}
              >
                <RText variant="body" family={fonts.bold}>
                  📍 Use my current location
                </RText>
              </PressableBox>
              {locate.status === 'locating' && (
                <View
                  style={[styles.suggestion, styles.optionRow]}
                  accessibilityLiveRegion="polite"
                >
                  <ActivityIndicator color={colors.primary} />
                  <RText variant="caption">Getting your location…</RText>
                </View>
              )}
              {locate.status === 'failed' && (
                <View style={styles.suggestion} accessibilityLiveRegion="polite">
                  <RText variant="caption" color={colors.danger}>
                    Couldn’t get your location. Try again outside or near a window.
                  </RText>
                </View>
              )}
              {locate.status === 'denied' && (
                <View
                  style={[styles.suggestion, styles.deniedRow]}
                  accessibilityLiveRegion="polite"
                >
                  <RText variant="caption" style={styles.flex}>
                    Location is off for Routly. Allow it to use where you are.
                  </RText>
                  <Pressable
                    onPress={() => void Linking.openSettings()}
                    accessibilityRole="button"
                    hitSlop={8}
                  >
                    <RText variant="body" size={13} family={fonts.extrabold} color={colors.primary}>
                      Open settings
                    </RText>
                  </Pressable>
                </View>
              )}
              <PressableBox
                onPress={chooseOnMap}
                disabled={busy}
                accessibilityRole="button"
                accessibilityLabel="Choose on map"
                style={[styles.suggestion, styles.optionRow]}
                pressedStyle={styles.pressed}
              >
                <RText variant="body" family={fonts.bold}>
                  🗺️ Choose on map
                </RText>
              </PressableBox>
            </View>

            <View style={styles.field}>
              <RText variant="fieldLabel">{entry?.place ? 'New address' : 'Address'}</RText>
              <TextInput
                value={query}
                onChangeText={(text) => {
                  setQuery(text);
                  setError(null);
                }}
                placeholder="Search for a place or address"
                placeholderTextColor={colors.textSecondary}
                accessibilityLabel="Search address"
                returnKeyType="search"
                style={styles.input}
              />
            </View>

            {query.trim().length > 0 && (
              <View style={styles.suggestions} accessibilityRole="list">
                {suggestions.map((s) => (
                  <PressableBox
                    key={s.placeId}
                    onPress={() => pick(s)}
                    disabled={busy}
                    accessibilityRole="button"
                    accessibilityLabel={[s.primary, s.secondary].filter(Boolean).join(', ')}
                    style={styles.suggestion}
                    pressedStyle={styles.pressed}
                  >
                    <RText variant="body" numberOfLines={1}>
                      {s.primary}
                    </RText>
                    {!!s.secondary && (
                      <RText variant="caption" numberOfLines={1}>
                        {s.secondary}
                      </RText>
                    )}
                  </PressableBox>
                ))}
                {loading && suggestions.length === 0 && (
                  <View style={styles.suggestion}>
                    <ActivityIndicator color={colors.primary} />
                  </View>
                )}
                {!loading && suggestions.length === 0 && (
                  <View style={styles.suggestion}>
                    <RText variant="caption">
                      {failed ? 'Search isn’t available right now.' : 'No places found.'}
                    </RText>
                  </View>
                )}
              </View>
            )}

            {error && (
              <RText variant="body" color={colors.danger} accessibilityLiveRegion="polite">
                {error}
              </RText>
            )}
            {busy && <ActivityIndicator color={colors.primary} />}

            {renamed && (
              <PressableBox
                onPress={rename}
                disabled={busy}
                accessibilityRole="button"
                style={styles.primary}
                pressedStyle={styles.primaryPressed}
              >
                <RText variant="body" family={fonts.extrabold} color={colors.textOnPrimary}>
                  Save name
                </RText>
              </PressableBox>
            )}

            {entry?.place && (
              <Pressable
                onPress={remove}
                disabled={busy}
                accessibilityRole="button"
                hitSlop={6}
                style={styles.delete}
              >
                <RText variant="body" family={fonts.extrabold} color={colors.danger}>
                  {fixed ? `Clear ${entry.label}` : `Delete ${entry.label}`}
                </RText>
              </Pressable>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 12,
  },
  close: {
    width: 44,
    height: 44,
    borderRadius: radius.iconBtn,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: { padding: 16, gap: 12 },
  flex: { flex: 1 },
  field: {
    backgroundColor: colors.surface,
    borderRadius: radius.tileSm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  input: {
    fontFamily: fonts.bold,
    fontSize: 15,
    color: colors.textPrimary,
    padding: 0,
    minHeight: 28,
  },
  current: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.primaryTint,
    borderRadius: radius.tileSm,
    padding: 12,
  },
  suggestions: {
    backgroundColor: colors.surface,
    borderRadius: radius.tileSm,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  suggestion: {
    minHeight: 52,
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  pressed: { backgroundColor: colors.background },
  optionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', gap: 10 },
  deniedRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  primary: {
    minHeight: 48,
    borderRadius: radius.tileSm,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryPressed: { backgroundColor: colors.primaryPressed },
  delete: { minHeight: 48, alignItems: 'center', justifyContent: 'center' },
});
