import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { PressableBox } from '@/components/routly/PressableBox';
import { RText } from '@/components/routly/RText';
import { placesService, type LatLng, type Place } from '@/services';
import { colors, fonts, radius } from '@/theme/routly';

import { PinMap } from './PinMap';

/** Where the confirm step opens (GPS fix, or the main map's centre). */
export interface PinStart {
  center: LatLng;
  /** GPS uncertainty in metres; null when the user chose on the map. */
  accuracyM: number | null;
  /** Already geocoded for `center` (Use my current location). */
  name?: string;
  placeId?: string | null;
}

interface PinConfirmProps {
  start: PinStart;
  /** "Save as Home". */
  saveLabel: string;
  busy: boolean;
  error: string | null;
  onSave: (place: Place) => void;
  onBack: () => void;
}

const GEOCODE_DEBOUNCE_MS = 600;
/** Above this the fix may be on the wrong building: ask the user to check. */
const ACCURACY_HINT_M = 30;
const MAX_NAME = 120;

/**
 * Confirm a pinned place: pan the map under the fixed pin, see the address
 * update, name it ("My home"), save. Saves the pin's coordinates, not the raw
 * GPS fix.
 */
export function PinConfirm({ start, saveLabel, busy, error, onSave, onBack }: PinConfirmProps) {
  const [center, setCenter] = useState(start.center);
  const [address, setAddress] = useState<{ name: string; placeId: string | null } | null>(
    start.name ? { name: start.name, placeId: start.placeId ?? null } : null,
  );
  const [looking, setLooking] = useState(!start.name);
  const [name, setName] = useState(start.name ?? '');
  /** Once the user types, panning no longer overwrites the name. */
  const edited = useRef(false);
  const first = useRef(true);

  // Address under the pin: debounced after each pan, cached by the service.
  useEffect(() => {
    // The opening position is already geocoded when we came from "Use my location".
    if (first.current) {
      first.current = false;
      if (start.name) return;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setLooking(true);
      placesService
        .reverseGeocode(center, { signal: controller.signal })
        .catch(() => ({ name: 'Pinned location', placeId: null }))
        .then((result) => {
          if (controller.signal.aborted) return;
          setAddress(result);
          setLooking(false);
          if (!edited.current) setName(result.name);
        });
    }, GEOCODE_DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [center, start.name]);

  const save = () => {
    const finalName = name.trim() || address?.name || 'Pinned location';
    onSave({
      // No geocode id → stored with place_id null (see supabaseSavedPlacesService).
      id: address?.placeId ?? 'saved:pin',
      name: finalName.slice(0, MAX_NAME),
      location: center,
    });
  };

  const showAccuracy = start.accuracyM !== null && start.accuracyM > ACCURACY_HINT_M;

  return (
    <View style={styles.wrap}>
      <PinMap initial={start.center} onCenterChange={setCenter} />

      <View style={styles.addressRow} accessibilityLiveRegion="polite">
        {looking ? (
          <ActivityIndicator color={colors.primary} />
        ) : (
          <RText variant="body" family={fonts.bold} numberOfLines={2} style={styles.flex}>
            {address?.name ?? 'Pinned location'}
          </RText>
        )}
        {looking && <RText variant="caption">Finding the address…</RText>}
      </View>

      {showAccuracy && (
        <RText variant="caption" color={colors.traffic.textModerate}>
          Accuracy ±{Math.round(start.accuracyM ?? 0)} m — adjust the pin if needed
        </RText>
      )}

      <View style={styles.field}>
        <RText variant="fieldLabel">Name</RText>
        <TextInput
          value={name}
          onChangeText={(text) => {
            edited.current = true;
            setName(text);
          }}
          placeholder="My home"
          placeholderTextColor={colors.textSecondary}
          maxLength={MAX_NAME}
          accessibilityLabel="Place name"
          returnKeyType="done"
          style={styles.input}
        />
      </View>

      {error && (
        <RText variant="body" color={colors.danger} accessibilityLiveRegion="polite">
          {error}
        </RText>
      )}

      <PressableBox
        onPress={save}
        disabled={busy || looking}
        accessibilityRole="button"
        accessibilityState={{ disabled: busy || looking, busy }}
        style={[styles.primary, (busy || looking) && styles.disabled]}
        pressedStyle={styles.primaryPressed}
      >
        {busy ? (
          <ActivityIndicator color={colors.textOnPrimary} />
        ) : (
          <RText variant="body" family={fonts.extrabold} color={colors.textOnPrimary}>
            {saveLabel}
          </RText>
        )}
      </PressableBox>

      <Pressable onPress={onBack} accessibilityRole="button" hitSlop={6} style={styles.back}>
        <RText variant="body" family={fonts.bold} color={colors.primary}>
          Back to search
        </RText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  flex: { flex: 1 },
  addressRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 28 },
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
  primary: {
    minHeight: 48,
    borderRadius: radius.tileSm,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryPressed: { backgroundColor: colors.primaryPressed },
  disabled: { opacity: 0.6 },
  back: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
});
