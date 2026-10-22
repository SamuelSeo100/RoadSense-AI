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
import { nextLegPreview, stopsRemaining, transferText } from '@/navigation/legView';
import { formatDistance, type NavStep } from '@/navigation/steps';
import type { BusEta } from '@/services';
import { formatHHMM, istMinutes } from '@/services/transit/time';
import { colors, fonts, modeColors, radius, shadows } from '@/theme/routly';

import { book } from '../trip/booking';
import { requestBusEtas, useBusLegEta } from '../trip/busEtaStore';

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
  const { view, muted, toggleMute, end, reroute, nextLeg, simSpeed, cycleSimSpeed } =
    useNavigation(request);
  // The started route's bus legs get their traffic-adjusted ETA (cached when it was a top route).
  useEffect(() => requestBusEtas([request.route]), [request.route]);
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
  const preview =
    view && !arrived ? nextLegPreview(view.steps, view.index, request.destination.name) : null;
  // On a ride, the change after it reads better than the next leg alone.
  const transferNext = view && riding ? transferText(view.steps, view.index) : null;

  return (
    <View style={styles.root}>
      <NavigationMap
        position={view?.position ?? null}
        heading={view?.heading ?? null}
        steps={view?.steps ?? []}
        currentLeg={step?.legIndex ?? null}
        simulated={request.simulate === true}
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
          <InstructionCard
            step={step}
            view={view!}
            destinationName={request.destination.name}
            now={now}
          />
        ) : null}
        {!arrived && view?.alert && (
          <Banner
            tone="alert"
            text={
              view.alert.kind === 'stopNext'
                ? `Your stop is next: ${view.alert.stop}`
                : `Get off soon: ${view.alert.stop}`
            }
          />
        )}
        {view?.rerouting && <Banner text="Finding a new route…" />}
        {!view?.rerouting && view?.offRoute && (
          <Banner
            text="You’re off route"
            action={view.canReroute ? { label: 'Reroute', onPress: reroute } : undefined}
          />
        )}
        {view?.locationDenied && <Banner text="Location is off: tap Next leg as you go" />}
        {request.simulate && (
          <View style={styles.simRow}>
            <View style={styles.simLabel} accessibilityLabel="Simulation, not real GPS">
              <RText variant="badge" color={colors.textOnPrimary}>
                SIMULATION
              </RText>
            </View>
            <PressableBox
              onPress={cycleSimSpeed}
              accessibilityRole="button"
              accessibilityLabel={`Playback speed ${simSpeed} times. Change`}
              style={styles.simSpeed}
              pressedStyle={styles.pressed}
            >
              <RText variant="badge" color={colors.primary}>
                {simSpeed}×
              </RText>
            </PressableBox>
          </View>
        )}
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
        {(transferNext || preview) && (
          <View
            style={styles.preview}
            accessibilityLabel={`Next: ${transferNext ?? preview!.text}`}
          >
            <Icon
              name={modeIcon[transferNext ? 'walk' : preview!.mode]}
              size={16}
              color={colors.textSecondary}
              strokeWidth={2.2}
            />
            <RText variant="caption" size={13} numberOfLines={2} style={styles.previewText}>
              Next: {transferNext ?? preview!.text}
            </RText>
          </View>
        )}
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
          {!arrived && view?.hasNextLeg && (
            <PressableBox
              onPress={nextLeg}
              accessibilityRole="button"
              accessibilityLabel="Next leg: I've finished this part of the trip"
              style={styles.secondary}
              pressedStyle={styles.pressed}
            >
              <RText variant="body" family={fonts.extrabold} color={colors.primary}>
                Next leg
              </RText>
            </PressableBox>
          )}
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

/** "~7–11", or "~7" when the range rounds to one number. */
function minRange(low: number, high: number): string {
  const lo = Math.max(0, Math.round(low));
  const hi = Math.max(lo, Math.round(high));
  return lo === hi ? `~${lo}` : `~${lo}–${hi}`;
}

/** Bus ETA from Phase 1: before boarding when it reaches the stop, then the ride range. */
function busEtaText(eta: BusEta, boarded: boolean, now: number): string {
  const badge = eta.source === 'scheduled_traffic' ? 'scheduled + traffic' : 'scheduled';
  const ride = `ride ${minRange(eta.rideLowMin, eta.rideHighMin)} min`;
  if (boarded) return `${ride} (${badge})`;
  const low = (eta.departLowAt - now) / 60_000;
  const high = (eta.departHighAt - now) / 60_000;
  const arrives =
    high < 1
      ? 'may have left the stop'
      : low < 1
        ? `due within ${minRange(0, high)} min`
        : `arrives in ${minRange(low, high)} min`;
  return `Bus ${arrives} · ${ride} (${badge})`;
}

/** Title and lines of the current-leg card, by mode. */
function cardText(
  step: NavStep,
  view: NavigationView,
  destinationName: string,
): { title: string; lines: string[] } {
  const t = step.transit;
  if (t) {
    const towards = t.headsign ? ` towards ${t.headsign}` : '';
    const stops = stopsRemaining(step, view.position, view.progressM);
    const stopsText = stops
      ? `${stops.estimated ? '~' : ''}${stops.count} stop${stops.count === 1 ? '' : 's'} left`
      : null;
    const dep = t.scheduledDep ? Date.parse(t.scheduledDep) : NaN;
    if (!view.boarded) {
      return {
        title: `Board the ${t.line}${towards} at ${t.boardStop}`,
        lines: [
          [
            Number.isFinite(dep) && t.mode !== 'bus' ? `Next ${t.mode} ${clock(dep)}` : null,
            `Get off at ${t.alightStop}`,
            t.stopCount ? `${t.stopCount} stop${t.stopCount === 1 ? '' : 's'}` : null,
          ]
            .filter(Boolean)
            .join(' · '),
        ],
      };
    }
    if (t.mode === 'bus') {
      return {
        title: `Stay on · get off at ${t.alightStop}`,
        lines: [
          [`~${formatDistance(view.legRemainingM)} left`, stopsText].filter(Boolean).join(' · '),
        ],
      };
    }
    return {
      title: `Stay on the ${t.line}${towards}`,
      lines: [[`Get off at ${t.alightStop}`, stopsText].filter(Boolean).join(' · ')],
    };
  }
  const legLeft = `${formatDistance(view.legRemainingM)} · ${Math.max(1, Math.round(view.legRemainingS / 60))} min`;
  if (step.kind === 'walk') {
    const next = view.steps[view.index + 1];
    const toTurn =
      view.stepDistanceM !== null
        ? `In ${formatDistance(view.stepDistanceM)}${next && !next.transit && next.legIndex === step.legIndex ? `, ${next.instruction}` : ''}`
        : null;
    const target = view.steps.find((s, i) => i > view.index && s.transit)?.transit?.boardStop;
    return {
      title: step.instruction,
      lines: [toTurn, `${legLeft} to ${target ?? destinationName}`].filter((l): l is string => !!l),
    };
  }
  return { title: step.instruction, lines: [`${legLeft} left on this leg`] };
}

function InstructionCard({
  step,
  view,
  destinationName,
  now,
}: {
  step: NavStep;
  view: NavigationView;
  destinationName: string;
  now: number;
}) {
  const transit = step.transit;
  const accent = transit?.lineColor ?? modeColors[step.legMode].line;
  const eta = useBusLegEta(transit?.bus);
  const { title, lines } = cardText(step, view, destinationName);
  const all = [...lines, ...(eta ? [busEtaText(eta, view.boarded, now)] : [])];
  // Walking between two rides: the whole change in one line.
  const transfer = step.kind === 'walk' ? transferText(view.steps, view.index) : null;
  const hired = (step.legMode === 'auto' || step.legMode === 'cab') && !step.ownVehicle;
  return (
    <View
      style={[styles.card, shadows.mapControl, { borderLeftColor: accent }]}
      accessibilityLiveRegion="polite"
      accessibilityLabel={[title, ...all, transfer].filter(Boolean).join('. ')}
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
        {transfer && (
          <RText variant="caption" size={12} family={fonts.extrabold} color={colors.primary}>
            {transfer}
          </RText>
        )}
        <RText variant="cardTitle" size={17} numberOfLines={3}>
          {title}
        </RText>
        {all.map((line) => (
          <RText key={line} variant="caption" size={13} numberOfLines={2}>
            {line}
          </RText>
        ))}
        {hired && (
          <PressableBox
            onPress={() => {
              const target = view.steps.find(
                (s, i) => i > view.index && s.legIndex !== step.legIndex,
              );
              void book(step.legMode === 'auto' ? 'auto' : 'cab', {
                pickup: view.position ?? step.polyline[0],
                drop: {
                  ...step.endPoint,
                  name: target?.transit?.boardStop ?? destinationName,
                },
              });
            }}
            accessibilityRole="button"
            accessibilityLabel={`Book ${step.legMode === 'auto' ? 'an auto' : 'a cab'}`}
            hitSlop={4}
            style={styles.book}
            pressedStyle={styles.pressed}
          >
            <RText variant="body" size={12} family={fonts.extrabold} color={colors.primary}>
              Book {step.legMode === 'auto' ? 'auto' : 'cab'}
            </RText>
          </PressableBox>
        )}
      </View>
    </View>
  );
}

function Banner({
  text,
  tone,
  action,
}: {
  text: string;
  tone?: 'alert';
  action?: { label: string; onPress: () => void };
}) {
  return (
    <View
      style={[styles.banner, tone === 'alert' && styles.bannerAlert, shadows.mapControl]}
      accessibilityLiveRegion="polite"
    >
      <RText variant="body" color={tone === 'alert' ? colors.toastBg : colors.textOnPrimary}>
        {text}
      </RText>
      {action && (
        <PressableBox
          onPress={action.onPress}
          accessibilityRole="button"
          accessibilityLabel={action.label}
          hitSlop={8}
          style={styles.bannerAction}
          pressedStyle={styles.pressed}
        >
          <RText variant="body" family={fonts.extrabold} color={colors.accent}>
            {action.label}
          </RText>
        </PressableBox>
      )}
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.toastBg,
    borderRadius: radius.pill,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  bannerAlert: { backgroundColor: colors.accent },
  bannerAction: { minHeight: 32, justifyContent: 'center' },
  book: {
    alignSelf: 'flex-start',
    minHeight: 34,
    justifyContent: 'center',
    paddingHorizontal: 12,
    marginTop: 4,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  simRow: { flexDirection: 'row', alignSelf: 'flex-start', gap: 8 },
  simLabel: {
    backgroundColor: colors.danger,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  simSpeed: {
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  preview: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  previewText: { flex: 1 },
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
