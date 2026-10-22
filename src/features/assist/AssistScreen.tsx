import { router } from 'expo-router';
import { Fragment, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  Keyboard,
  KeyboardAvoidingView,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  FadeInDown,
  SlideInDown,
  runOnJS,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { Icon } from '@/components/routly/Icon';
import { ModePill } from '@/components/routly/ModePill';
import { PressableBox } from '@/components/routly/PressableBox';
import { RText } from '@/components/routly/RText';
import { routeCost, shortLegLabel } from '@/components/routly/routeFormat';
import { locationService, placesService, type RankedRoute, type Vehicle } from '@/services';
import { useRoutlyPrefs } from '@/store/routlyPrefsStore';
import { colors, fonts, radius } from '@/theme/routly';

import {
  dismissAssist,
  dismissKeyguard,
  isLocked,
  isOverlay,
  leaveAssist,
  revealAssist,
} from '../../../modules/routly-assist';
import { useVoiceInput } from '../home/useVoiceInput';
import { useMapStore } from '../map/mapStore';
import { requestBusEtas, useDurationRanges } from '../trip/busEtaStore';
import { shownRoutes, useTripStore } from '../trip/tripStore';
import { usePlaceAutocomplete } from '../trip/usePlaceAutocomplete';

const NO_VEHICLES: Record<Vehicle, boolean> = { car: false, bike: false, cycle: false };
const TOP = 3;
const PANEL_RADIUS = 24;
const GLOW = 3;
/** Swipe the panel down this far (or fast) to dismiss. */
const DISMISS_DY = 90;

const AnimatedRect = Animated.createAnimatedComponent(Rect);

/**
 * Close mode overlay (power-button long-press, also over the lock screen): a floating
 * panel over whatever is behind, dimmed. "Where to?" by voice or text, from the current
 * location, then the top 3 ranked routes; picking one unlocks the phone if needed and
 * opens it on Routes. Shows nothing personal: no saved places, history or name (a spoken
 * "home" is searched as a place, not resolved to the saved address).
 */
export function AssistScreen() {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [destination, setDestination] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  // Translucent overlay only when the native side made the window see-through.
  const [overlay] = useState(isOverlay);
  const sessionToken = useTripStore((s) => s.sessionToken);
  const state = useTripStore((s) => s.routes);
  const priority = useTripStore((s) => s.priority);
  const vehicles = useRoutlyPrefs((s) => s.prefs?.vehicles) ?? NO_VEHICLES;
  const near = useMapStore((s) => s.userLocation);

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

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      closeOverlay();
      return true;
    });
    return () => sub.remove();
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

  // Swipe the panel down to dismiss.
  const dragY = useSharedValue(0);
  const pan = Gesture.Pan()
    .activeOffsetY(12)
    .onUpdate((e) => {
      dragY.value = Math.max(0, e.translationY);
    })
    .onEnd((e) => {
      if (e.translationY > DISMISS_DY || e.velocityY > 900) runOnJS(closeOverlay)();
      else dragY.value = withSpring(0);
    });
  const panelDrag = useAnimatedStyle(() => ({ transform: [{ translateY: dragY.value }] }));

  return (
    <GestureHandlerRootView style={styles.root}>
      <Pressable
        style={[StyleSheet.absoluteFill, overlay ? styles.dim : styles.opaque]}
        onPress={closeOverlay}
        accessibilityRole="button"
        accessibilityLabel="Close"
      />
      <KeyboardAvoidingView style={styles.bottom} behavior="padding" pointerEvents="box-none">
        <GestureDetector gesture={pan}>
          <Animated.View
            entering={SlideInDown.duration(320).easing(Easing.out(Easing.cubic))}
            style={[styles.panelWrap, { marginBottom: insets.bottom + 12 }, panelDrag]}
          >
            <Glow listening={voice.listening} />
            <View style={styles.panel}>
              <View style={styles.grabber} />
              <View style={styles.brand}>
                <View style={styles.brandDot} />
                <RText variant="body" size={13} family={fonts.extrabold} color={colors.primary}>
                  Routly
                </RText>
                <RText variant="caption" size={12}>
                  · from your current location
                </RText>
              </View>

              <View style={styles.pill}>
                <TextInput
                  value={query}
                  onChangeText={(t) => {
                    setQuery(t);
                    if (destination) setDestination(null);
                  }}
                  onSubmitEditing={() => void planText(query)}
                  placeholder="Ask Routly — where to?"
                  placeholderTextColor={colors.textSecondary}
                  returnKeyType="search"
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
                    <Icon name="mic" size={20} color={colors.textOnPrimary} />
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
                suggestions.slice(0, 4).map((s) => (
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
                    <RText
                      variant="body"
                      family={fonts.extrabold}
                      numberOfLines={1}
                      style={styles.flex}
                    >
                      To {destination}
                    </RText>
                    <PressableBox
                      onPress={() => {
                        setDestination(null);
                        setQuery('');
                        setMessage(null);
                      }}
                      accessibilityRole="button"
                      hitSlop={8}
                    >
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
                  {top.map((route, i) => (
                    <RouteRow
                      key={route.id}
                      route={route}
                      index={i}
                      range={ranges.get(route.id)}
                      onPress={() => void open(route)}
                    />
                  ))}
                </View>
              )}
            </View>
          </Animated.View>
        </GestureDetector>
      </KeyboardAvoidingView>
    </GestureHandlerRootView>
  );
}

/** Back to whatever was behind the overlay; the app itself opens on Home next time. */
function closeOverlay() {
  Keyboard.dismiss();
  dismissAssist();
  setTimeout(() => router.replace('/home'), 300);
}

/** One of the top 3: time (bus ETA range), fare / fuel cost, mode pills. Rises in, staggered. */
function RouteRow({
  route,
  index,
  range,
  onPress,
}: {
  route: RankedRoute;
  index: number;
  range: { lowMin: number; highMin: number } | undefined;
  onPress: () => void;
}) {
  const time =
    range && range.highMin > range.lowMin
      ? `${range.lowMin}–${range.highMin}`
      : String(range?.lowMin ?? route.durationMin);
  return (
    <Animated.View entering={FadeInDown.delay(index * 80).duration(260)}>
      <PressableBox
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${route.name}, ${time.replace('–', ' to ')} minutes, ${routeCost(route)}. Open in Routly`}
        style={styles.card}
        pressedStyle={styles.pressed}
      >
        <View style={styles.cardRow}>
          <RText variant="price" size={22}>
            {time}
            <RText variant="caption"> min</RText>
          </RText>
          <RText variant="body" size={15} family={fonts.extrabold}>
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
    </Animated.View>
  );
}

/** Routly gradient along the panel edge, gently pulsing; stronger while the mic listens. */
function Glow({ listening }: { listening: boolean }) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  const pulse = useSharedValue(0);
  useEffect(() => {
    pulse.value = 0;
    pulse.value = withRepeat(
      withTiming(1, { duration: listening ? 650 : 1800, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
  }, [listening, pulse]);
  const low = listening ? 0.45 : 0.35;
  const high = listening ? 1 : 0.75;
  const width = listening ? 2 : 1;
  const props = useAnimatedProps(() => ({
    strokeOpacity: low + (high - low) * pulse.value,
    strokeWidth: GLOW + width * pulse.value,
  }));
  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
      onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
    >
      {size.w > 0 && (
        <Svg width={size.w} height={size.h}>
          <Defs>
            <LinearGradient id="routlyGlow" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={colors.primary} />
              <Stop offset="1" stopColor={colors.accent} />
            </LinearGradient>
          </Defs>
          <AnimatedRect
            x={GLOW}
            y={GLOW}
            width={size.w - GLOW * 2}
            height={size.h - GLOW * 2}
            rx={PANEL_RADIUS}
            fill="none"
            stroke="url(#routlyGlow)"
            animatedProps={props}
          />
        </Svg>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'transparent' },
  dim: { backgroundColor: 'rgba(0,0,0,0.4)' },
  opaque: { backgroundColor: colors.background },
  bottom: { flex: 1, justifyContent: 'flex-end' },
  flex: { flex: 1 },
  panelWrap: { marginHorizontal: 12, padding: GLOW },
  panel: {
    backgroundColor: colors.surface,
    borderRadius: PANEL_RADIUS,
    padding: 16,
    gap: 12,
  },
  grabber: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  brandDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.accent },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    paddingLeft: 18,
    paddingRight: 6,
    minHeight: 56,
  },
  input: { flex: 1, fontFamily: fonts.semibold, fontSize: 16, color: colors.textPrimary },
  mic: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  micOn: { backgroundColor: colors.accent },
  pressed: { opacity: 0.8 },
  suggestion: { paddingVertical: 8, gap: 2 },
  results: { gap: 10 },
  resultsHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  card: { backgroundColor: colors.background, borderRadius: radius.card, padding: 14, gap: 8 },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  legs: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
});
