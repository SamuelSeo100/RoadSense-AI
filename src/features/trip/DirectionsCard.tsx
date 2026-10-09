import { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import { useState, type Ref } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  Pressable,
  StyleSheet,
  View,
  type TextInput,
} from 'react-native';

import { Icon } from '@/components/routly/Icon';
import { IconButton } from '@/components/routly/IconButton';
import { PressableBox } from '@/components/routly/PressableBox';
import { RouteRail } from '@/components/routly/RouteRail';
import { RText } from '@/components/routly/RText';
import type { Place, PlaceSuggestion } from '@/services';
import { colors, fonts, radius, shadows } from '@/theme/routly';

import { useMapStore } from '../map/mapStore';
import { placeIcon } from '../places/placeIcon';
import { isSet, useSavedPlaces } from '../places/savedPlaces';

import { useTripStore } from './tripStore';
import { usePlaceAutocomplete } from './usePlaceAutocomplete';

type Field = 'from' | 'to';

const START = { start: 0, end: 0 };

interface DirectionsCardProps {
  toInputRef?: Ref<TextInput>;
  /** Called after From or To changes while a destination is set (Home → Routes). */
  onPicked?: () => void;
  onError: (message: string) => void;
}

/** From/To search with place suggestions. Shared by Home and Routes (trip store). */
export function DirectionsCard({ toInputRef, onPicked, onError }: DirectionsCardProps) {
  const trip = useTripStore();
  const area = useMapStore((s) => s.area);
  const near = useMapStore((s) => s.userLocation);
  const saved = useSavedPlaces().filter(isSet);
  const [active, setActive] = useState<Field | null>(null);
  /** The field holding keyboard focus (drives the text scroll position). */
  const [focused, setFocused] = useState<Field | null>(null);
  const draft = active === 'from' ? trip.fromDraft : active === 'to' ? trip.toDraft : null;
  const { suggestions, loading, failed } = usePlaceAutocomplete(draft ?? '', {
    enabled: draft !== null,
    sessionToken: trip.sessionToken,
    near,
  });

  const currentLabel = area ? `Your location · ${area}` : 'Your location';
  const fromValue =
    trip.fromDraft ?? (trip.from.kind === 'current' ? currentLabel : trip.from.place.name);
  const toValue = trip.toDraft ?? trip.to?.name ?? '';

  const afterPick = () => {
    if (useTripStore.getState().to) onPicked?.();
  };

  const pick = async (field: Field, s: PlaceSuggestion) => {
    Keyboard.dismiss();
    setActive(null);
    try {
      const place = await trip.resolve(s.placeId);
      if (field === 'from') trip.pickFrom({ kind: 'place', place });
      else trip.pickTo(place);
      afterPick();
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Couldn’t open that place.');
    }
  };

  const pickSaved = (field: Field, place: Place) => {
    Keyboard.dismiss();
    setActive(null);
    if (field === 'from') trip.pickFrom({ kind: 'place', place });
    else trip.pickTo(place);
    afterPick();
  };

  const useMyLocation = () => {
    Keyboard.dismiss();
    setActive(null);
    trip.pickFrom({ kind: 'current' });
    afterPick();
  };

  const showList = active !== null && draft !== null && draft.trim().length > 0;
  // Nothing typed yet: saved places first (the field may still show the current pick).
  const showSaved = focused !== null && focused === active && !showList && saved.length > 0;

  return (
    <View style={[styles.card, shadows.selectedCard]}>
      <View style={styles.body}>
        <RouteRail />
        <View style={styles.fields}>
          <View style={styles.field}>
            <RText variant="fieldLabel">From</RText>
            <BottomSheetTextInput
              value={fromValue}
              onChangeText={trip.setFromDraft}
              onFocus={() => {
                setActive('from');
                setFocused('from');
              }}
              // Android scrolls long text to its end; show the start when not editing.
              selection={focused === 'from' ? undefined : START}
              onBlur={() => {
                setFocused(null);
                if (trip.fromDraft !== null && !trip.fromDraft.trim()) trip.setFromDraft(null);
              }}
              selectTextOnFocus
              accessibilityLabel="From"
              returnKeyType="search"
              style={styles.input}
            />
          </View>
          <View style={styles.field}>
            <RText variant="fieldLabel">To</RText>
            <BottomSheetTextInput
              ref={toInputRef as Ref<never>}
              value={toValue}
              onChangeText={trip.setToDraft}
              onFocus={() => {
                setActive('to');
                setFocused('to');
              }}
              onBlur={() => setFocused(null)}
              selection={focused === 'to' ? undefined : START}
              placeholder="Where to?"
              placeholderTextColor={colors.textSecondary}
              selectTextOnFocus
              accessibilityLabel="To"
              returnKeyType="search"
              style={styles.input}
            />
          </View>
        </View>
        <IconButton
          icon="swap"
          accessibilityLabel="Swap From and To"
          onPress={() => {
            trip.swap();
            afterPick();
          }}
        />
      </View>

      {active === 'from' && trip.from.kind === 'place' && (
        <Pressable onPress={useMyLocation} accessibilityRole="button" style={styles.suggestion}>
          <RText variant="body" color={colors.primary}>
            ◎ Use my location
          </RText>
        </Pressable>
      )}

      {showSaved && (
        <View style={styles.suggestions} accessibilityRole="list">
          {saved.map((sp) => {
            const { icon, fg } = placeIcon(sp.label);
            return (
              <PressableBox
                key={sp.label}
                onPress={() => pickSaved(focused, sp.place)}
                accessibilityRole="button"
                accessibilityLabel={`${sp.label}, ${sp.place.name}`}
                style={[styles.suggestion, styles.savedRow]}
                pressedStyle={styles.pressed}
              >
                <Icon name={icon} size={18} color={fg} />
                <View style={styles.savedText}>
                  <RText variant="body" numberOfLines={1}>
                    {sp.label}
                  </RText>
                  <RText variant="caption" numberOfLines={1}>
                    {sp.place.name}
                  </RText>
                </View>
              </PressableBox>
            );
          })}
        </View>
      )}

      {showList && (
        <View style={styles.suggestions} accessibilityRole="list">
          {suggestions.map((s) => (
            <PressableBox
              key={s.placeId}
              onPress={() => pick(active, s)}
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
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.primary,
    borderRadius: radius.card,
    padding: 16,
    gap: 12,
  },
  body: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  fields: { flex: 1, gap: 8 },
  field: {
    backgroundColor: colors.background,
    borderRadius: radius.tileSm,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  input: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.textPrimary,
    padding: 0,
    minHeight: 22,
  },
  suggestions: {
    borderRadius: radius.tileSm,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  suggestion: {
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  pressed: { backgroundColor: colors.background },
  savedRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', gap: 10 },
  savedText: { flex: 1, minWidth: 0 },
});
