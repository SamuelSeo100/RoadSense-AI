import { useKeepAwake } from 'expo-keep-awake';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { BackHandler, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, modeIcon } from '@/components/routly/Icon';
import { IconButton } from '@/components/routly/IconButton';
import { PressableBox } from '@/components/routly/PressableBox';
import { RText } from '@/components/routly/RText';
import { formatClock12 } from '@/components/routly/routeFormat';
import { confirm } from '@/lib/confirm';
import { formatDistance, type NavStep } from '@/navigation/steps';
import { formatHHMM, istMinutes } from '@/services/transit/time';
import { colors, fonts, modeColors, radius, shadows } from '@/theme/routly';

import { NavigationMap } from './components/NavigationMap';
import { useNavigationStore, type NavigationRequest } from './navigationStore';
import { useNavigation, type NavigationView } from './useNavigation';

/** "4:48 PM" in India time, like the route cards. */
const clock = (ms: number) => formatClock12(formatHHMM(istMinutes(new Date(ms))));

function formatDuration(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

const leave = () => (router.canGoBack() ? router.back() : router.replace('/routes'));

/** Step-by-step navigation for the route picked on Routes ("Start"). */
export function NavigationScreen() {
  const request = useNavigationStore((s) => s.active);
  useEffect(() => {
    // Opened without a trip (e.g. a deep link): nothing to navigate.
    if (!useNavigationStore.getState().active) leave();
    return () => useNavigationStore.getState().clear();
  }, []);
  return request ? <ActiveNavigation request={request} /> : null;
}

function ActiveNavigation({ request }: { request: NavigationRequest }) {
  useKeepAwake();
  const insets = useSafeAreaInsets();
  const { view, muted, toggleMute, end } = useNavigation(request);
  const [follow, setFollow] = useState(true);
  const [now, setNow] = useState(() => Date.now());
  const [topHeight, setTopHeight] = useState(140);
  const [bottomHeight, setBottomHeight] = useState(160);

  // Remaining time ticks even without new fixes (waiting on a platform).
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(t);
  }, []);

  const endTrip = useCallback(async () => {
    if (view?.status === 'navigating') {
      const ok = await confirm(
        'End trip?',
        'Navigation stops and the trip is saved as ended.',
        'End trip',
      );
      if (!ok) return;
      end();
    }
    leave();
  }, [end, view?.status]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      void endTrip();
      return true;
    });
    return () => sub.remove();
  }, [endTrip]);

  const step = view?.step ?? null;
  const riding = step?.kind === 'transit';
  const arrived = view?.status === 'arrived';
  const minutesLeft = view ? Math.max(0, Math.round((view.arrivalAt - now) / 60_000)) : null;

  return (
    <View style={styles.root}>
      <NavigationMap
        position={view?.position ?? null}
        heading={view?.heading ?? null}
        paths={view?.remainingPaths ?? []}
        destination={request.destination}
        follow={follow}
        onPan={() => setFollow(false)}
        riding={riding}
        insets={{ top: topHeight, bottom: bottomHeight }}
      />

      <View
        style={[styles.top, { paddingTop: insets.top + 8 }]}
        onLayout={(e) => setTopHeight(e.nativeEvent.layout.height)}
      >
        {arrived ? (
          <Banner text={`You’ve arrived at ${request.destination.name}`} />
        ) : step ? (
          <InstructionCard step={step} view={view!} />
        ) : null}
        {view?.rerouting && <Banner text="Finding a new route…" />}
        {!view?.rerouting && view?.offRoute && <Banner text="Off route" />}
      </View>

      {!follow && (
        <IconButton
          icon="locate"
          floating
          accessibilityLabel="Recenter on my location"
          onPress={() => setFollow(true)}
          style={[styles.recenter, { bottom: bottomHeight + 12 }]}
        />
      )}

      <View
        style={[styles.bottom, shadows.sheet, { paddingBottom: insets.bottom + 16 }]}
        onLayout={(e) => setBottomHeight(e.nativeEvent.layout.height)}
      >
        <View style={styles.stats}>
          <Stat label="Arrive" value={view ? clock(arrived ? now : view.arrivalAt) : '–'} big />
          <Stat
            label="Time left"
            value={minutesLeft === null || arrived ? '–' : formatDuration(minutesLeft)}
          />
          <Stat label="Distance" value={view && !arrived ? formatDistance(view.remainingM) : '–'} />
        </View>
        <View style={styles.actions}>
          <PressableBox
            onPress={toggleMute}
            accessibilityRole="switch"
            accessibilityState={{ checked: !muted }}
            accessibilityLabel="Voice guidance"
            style={[styles.secondary, muted && styles.secondaryOff]}
            pressedStyle={styles.pressed}
          >
            <RText
              variant="body"
              family={fonts.extrabold}
              color={muted ? colors.textSecondary : colors.primary}
            >
              {muted ? 'Voice off' : 'Voice on'}
            </RText>
          </PressableBox>
          <PressableBox
            onPress={() => void endTrip()}
            accessibilityRole="button"
            accessibilityLabel={arrived ? 'Done' : 'End trip'}
            style={styles.end}
            pressedStyle={styles.pressed}
          >
            <RText variant="button">{arrived ? 'Done' : 'End trip'}</RText>
          </PressableBox>
        </View>
      </View>
    </View>
  );
}

function rideSubtitle(step: NavStep, view: NavigationView): string {
  const t = step.transit!;
  if (view.boarded) return `Get off at ${t.alightStop}`;
  const dep = t.scheduledDep ? Date.parse(t.scheduledDep) : NaN;
  return Number.isFinite(dep)
    ? `Next ${t.mode === 'train' ? 'train' : t.mode} ${clock(dep)} · ${t.boardStop}`
    : `At ${t.boardStop}`;
}

function InstructionCard({ step, view }: { step: NavStep; view: NavigationView }) {
  const transit = step.transit;
  const accent = transit?.lineColor ?? modeColors[step.legMode].line;
  const subtitle = transit
    ? rideSubtitle(step, view)
    : view.stepDistanceM !== null
      ? `${formatDistance(view.stepDistanceM)}${view.next && !view.next.transit ? ` · then ${view.next.instruction}` : ''}`
      : null;
  return (
    <View
      style={[styles.card, shadows.mapControl, { borderLeftColor: accent }]}
      accessibilityLiveRegion="polite"
      accessibilityLabel={[step.instruction, subtitle].filter(Boolean).join('. ')}
    >
      <View style={[styles.icon, { backgroundColor: accent }]}>
        <Icon
          name={modeIcon[step.legMode]}
          size={22}
          color={colors.textOnPrimary}
          strokeWidth={2.2}
        />
      </View>
      <View style={styles.cardText}>
        <RText variant="cardTitle" size={17} numberOfLines={3}>
          {step.instruction}
        </RText>
        {subtitle && (
          <RText variant="caption" size={13} numberOfLines={2}>
            {subtitle}
          </RText>
        )}
      </View>
    </View>
  );
}

function Banner({ text }: { text: string }) {
  return (
    <View style={[styles.banner, shadows.mapControl]} accessibilityLiveRegion="polite">
      <RText variant="body" color={colors.textOnPrimary}>
        {text}
      </RText>
    </View>
  );
}

function Stat({ label, value, big }: { label: string; value: string; big?: boolean }) {
  return (
    <View style={styles.stat}>
      <RText variant="small">{label}</RText>
      <RText
        variant={big ? 'price' : 'body'}
        size={big ? undefined : 16}
        family={fonts.extrabold}
        numberOfLines={1}
      >
        {value}
      </RText>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.map.land },
  top: { position: 'absolute', top: 0, left: 0, right: 0, paddingHorizontal: 16, gap: 8 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderLeftWidth: 6,
    padding: 14,
  },
  icon: {
    width: 44,
    height: 44,
    borderRadius: radius.iconBtn,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardText: { flex: 1, gap: 4 },
  banner: {
    alignSelf: 'center',
    backgroundColor: colors.toastBg,
    borderRadius: radius.pill,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  recenter: { position: 'absolute', right: 16 },
  bottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    paddingTop: 16,
    paddingHorizontal: 16,
    gap: 14,
  },
  stats: { flexDirection: 'row', alignItems: 'flex-end' },
  stat: { flex: 1, gap: 2 },
  actions: { flexDirection: 'row', gap: 10 },
  secondary: {
    minHeight: 48,
    paddingHorizontal: 16,
    borderRadius: radius.input,
    borderWidth: 1,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryOff: { borderColor: colors.borderStrong },
  end: {
    flex: 1,
    minHeight: 48,
    borderRadius: radius.input,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.8 },
});
