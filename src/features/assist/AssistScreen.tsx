import { router } from 'expo-router';
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Keyboard, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  dismissKeyguard,
  isLocked,
  leaveAssist,
  revealAssist,
} from '../../../modules/routly-assist';
import { Icon } from '@/components/routly/Icon';
import { ModePill } from '@/components/routly/ModePill';
import { PressableBox } from '@/components/routly/PressableBox';
import { RText } from '@/components/routly/RText';
import { routeCost, shortLegLabel } from '@/components/routly/routeFormat';
import { locationService, placesService, type RankedRoute, type Vehicle } from '@/services';
import { useRoutlyPrefs } from '@/store/routlyPrefsStore';
import { colors, fonts, radius } from '@/theme/routly';

import { useVoiceInput } from '../home/useVoiceInput';
import { useMapStore } from '../map/mapStore';
import { requestBusEtas, useDurationRanges } from '../trip/busEtaStore';
import { shownRoutes, useTripStore } from '../trip/tripStore';
import { usePlaceAutocomplete } from '../trip/usePlaceAutocomplete';

const NO_VEHICLES: Record<Vehicle, boolean> = { car: false, bike: false, cycle: false };
const TOP = 3;

/**
 * Close mode (power-button long-press, also over the lock screen): "Where to?" by voice or
 * text, from the current location, then the top 3 ranked routes. Picking one unlocks the
 * phone if needed and opens it on Routes. Shows nothing personal: no saved places, history
 * or name (a spoken "home" is searched as a place, not resolved to the saved address).
 */
export function AssistScreen() {
  const [query, setQuery] = useState('');
  const [destination, setDestination] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const sessionToken = useTripStore((s) => s.sessionToken);
  const state = useTripStore((s) => s.routes);
  const priority = useTripStore((s) => s.priority);
  const vehicles = useRoutlyPrefs((s) => s.prefs?.vehicles) ?? NO_VEHICLES;
  const near = useMapStore((s) => s.userLocation);
  const inputRef = useRef<TextInput>(null);

  // On screen: drop the launch cover; leaving: never over the lock screen again.
  useEffect(() => {
    revealAssist();
    return () => leaveAssist();
  }, []);

  // Origin = where the phone is (the map, which usually tracks it, may not be mounted).
  useEffect(() => {
    if (useMapStore.getState().userLocation) return;
    locationService
      .currentFix({ timeoutMs: 10_000 })
      .then((fix) => useMapStore.getState().setUserLocation(fix.position))
      .catch(() => setMessage('Couldn’t get your location. Turn on location and try again.'));
  }, []);

  const { suggestions } = usePlaceAutocomplete(query, {
    enabled: destination === null,
    sessionToken,
    near,
  });

  const plan = async (placeId: string, label: string) => {
    Keyboard.dismiss();
    setMessage(null);
    setDestination(label);
    try {
      const place = await useTripStore.getState().resolve(placeId);
      // Always from here (never a From place left over in the app).
      useTripStore.setState({ from: { kind: 'current' }, modeFilter: null });
      useTripStore.getState().pickTo(place);
    } catch {
      setDestination(null);
      setMessage('Couldn’t find that place. Try again.');
    }
  };

  /** Spoken (or submitted) text: the best Places match. */
  const planText = async (text: string) => {
    const q = text.trim();
    if (!q) return;
    setQuery(q);
    try {
      const [best] = await placesService.autocomplete(q, {
        sessionToken,
        near: near ?? undefined,
      });
      if (best) await plan(best.placeId, best.primary);
      else setMessage(`No place found for “${q}”.`);
    } catch {
      setMessage('Couldn’t search right now. Check your connection.');
    }
  };

  const voice = useVoiceInput({
    onTranscript: setQuery,
    onDone: (text) => void planText(text),
    onError: setMessage,
  });

  const ready = destination !== null && state.status === 'ready' ? state : null;
  const top = useMemo(
    () => (ready ? shownRoutes(ready.routes, priority, vehicles).slice(0, TOP) : []),
    [ready, priority, vehicles],
  );
  useEffect(() => requestBusEtas(top), [top]);
  const ranges = useDurationRanges(top);

  const open = async (route: RankedRoute) => {
    if (isLocked() && !(await dismissKeyguard())) return; // stays here if unlock was cancelled
    leaveAssist();
    router.replace({ pathname: '/routes', params: { open: route.id } });
  };

  const reset = () => {
    setDestination(null);
    setQuery('');
    setMessage(null);
    inputRef.current?.focus();
  };

  return (
    <SafeAreaView style={styles.root}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <RText variant="sectionTitle" size={24} accessibilityRole="header">
          Where to?
        </RText>
        <RText variant="caption">From your current location</RText>

        <View style={styles.inputRow}>
          <TextInput
            ref={inputRef}
            value={query}
            onChangeText={(t) => {
              setQuery(t);
              if (destination) setDestination(null);
            }}
            onSubmitEditing={() => void planText(query)}
            placeholder="Say or type a place"
            placeholderTextColor={colors.textSecondary}
            returnKeyType="search"
            autoFocus={false}
            style={styles.input}
            accessibilityLabel="Destination"
          />
          <PressableBox
            onPress={() => void voice.toggle()}
            accessibilityRole="button"
            accessibilityLabel={voice.listening ? 'Stop listening' : 'Speak your destination'}
            style={[styles.mic, voice.listening && styles.micOn]}
            pressedStyle={styles.pressed}
          >
            {voice.starting ? (
              <ActivityIndicator color={colors.textOnPrimary} />
            ) : (
              <Icon name="mic" size={22} color={colors.textOnPrimary} />
            )}
          </PressableBox>
        </View>
        {voice.listening && <RText variant="caption">Listening…</RText>}
        {message && (
          <RText variant="caption" color={colors.danger}>
            {message}
          </RText>
        )}

        {destination === null &&
          suggestions.map((s) => (
            <PressableBox
              key={s.placeId}
              onPress={() => void plan(s.placeId, s.primary)}
              accessibilityRole="button"
              accessibilityLabel={`${s.primary}${s.secondary ? `, ${s.secondary}` : ''}`}
              style={styles.suggestion}
              pressedStyle={styles.pressed}
            >
              <RText variant="body" family={fonts.extrabold} numberOfLines={1}>
                {s.primary}
              </RText>
              {s.secondary && (
                <RText variant="caption" numberOfLines={1}>
                  {s.secondary}
                </RText>
              )}
            </PressableBox>
          ))}

        {destination !== null && (
          <View style={styles.results}>
            <View style={styles.resultsHeader}>
              <RText variant="body" family={fonts.extrabold} numberOfLines={1} style={styles.flex}>
                To {destination}
              </RText>
              <PressableBox onPress={reset} accessibilityRole="button" hitSlop={8}>
                <RText variant="body" family={fonts.extrabold} color={colors.primary}>
                  Change
                </RText>
              </PressableBox>
            </View>
            {state.status === 'loading' && <ActivityIndicator color={colors.primary} />}
            {state.status === 'error' && (
              <RText variant="caption" color={colors.danger}>
                {state.message}
              </RText>
            )}
            {ready && top.length === 0 && <RText variant="caption">No routes found.</RText>}
            {top.map((route) => {
              const range = ranges.get(route.id);
              const time =
                range && range.highMin > range.lowMin
                  ? `${range.lowMin}–${range.highMin}`
                  : String(range?.lowMin ?? route.durationMin);
              return (
                <PressableBox
                  key={route.id}
                  onPress={() => void open(route)}
                  accessibilityRole="button"
                  accessibilityLabel={`${route.name}, ${time.replace('–', ' to ')} minutes, ${routeCost(route)}. Open in Routly`}
                  style={styles.card}
                  pressedStyle={styles.pressed}
                >
                  <View style={styles.cardRow}>
                    <RText variant="price">
                      {time}
                      <RText variant="caption"> min</RText>
                    </RText>
                    <RText variant="body" size={16} family={fonts.extrabold}>
                      {routeCost(route)}
                    </RText>
                  </View>
                  <View style={styles.legs}>
                    {route.legs.map((leg, i) => (
                      <Fragment key={`${leg.label}-${i}`}>
                        {i > 0 && (
                          <RText variant="body" color={colors.separator}>
                            ›
                          </RText>
                        )}
                        <ModePill mode={leg.mode} label={shortLegLabel(leg)} icon />
                      </Fragment>
                    ))}
                  </View>
                </PressableBox>
              );
            })}
            {top.length > 0 && <RText variant="small">Tap a route to open it in Routly.</RText>}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, gap: 12 },
  flex: { flex: 1 },
  inputRow: { flexDirection: 'row', gap: 10, alignItems: 'center', marginTop: 8 },
  input: {
    flex: 1,
    minHeight: 52,
    borderRadius: radius.input,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    fontFamily: fonts.semibold,
    fontSize: 16,
    color: colors.textPrimary,
  },
  mic: {
    width: 52,
    height: 52,
    borderRadius: radius.input,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  micOn: { backgroundColor: colors.accent },
  pressed: { opacity: 0.8 },
  suggestion: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 2,
  },
  results: { gap: 12, marginTop: 4 },
  resultsHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 10,
  },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  legs: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
});
