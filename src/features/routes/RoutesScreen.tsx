import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View, type TextInput } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';

import { Chip } from '@/components/routly/Chip';
import { RouteCard } from '@/components/routly/RouteCard';
import { RText } from '@/components/routly/RText';
import { SkeletonCard } from '@/components/routly/SkeletonCard';
import { ToggleTile } from '@/components/routly/ToggleTile';
import {
  PRIORITIES,
  fallbackOrigin,
  historyService,
  priorityLabels,
  rankRoutes,
  routingService,
  type Place,
  type Priority,
  type Route,
  type Vehicle,
} from '@/services';
import { useRoutlyPrefs } from '@/store/routlyPrefsStore';
import { colors, fonts, radius } from '@/theme/routly';

import { useMapStore } from '../map/mapStore';
import { SheetScrollView } from '../shell/SheetScrollView';
import { SHEET_FULL, SHEET_PEEK } from '../shell/shellStore';
import { useMapContent, useSheet, useTopBar } from '../shell/useScreenChrome';

import { FromToCard } from './components/FromToCard';

const ALL_VEHICLES: Record<Vehicle, boolean> = { car: true, bike: true, cycle: true };
const isPriority = (v: unknown): v is Priority => PRIORITIES.includes(v as Priority);
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? '';

export function RoutesScreen() {
  const params = useLocalSearchParams<{ from?: string; to?: string; priority?: string }>();
  const prefs = useRoutlyPrefs((s) => s.prefs);
  const updatePrefs = useRoutlyPrefs((s) => s.update);
  const area = useMapStore((s) => s.area);
  const sheet = useSheet('routes');
  const fromRef = useRef<TextInput>(null);

  // The trip being shown, and the drafts in the From/To inputs.
  const [trip, setTrip] = useState({ from: one(params.from), to: one(params.to) });
  const [draft, setDraft] = useState(trip);
  const [priority, setPriority] = useState<Priority | null>(
    isPriority(params.priority) ? params.priority : null,
  );

  // New params (AI Mode, Find routes, Repeat) replace the trip. Adjusted
  // during render (not in an effect) so the old trip never flashes.
  const paramsKey = `${one(params.from)}|${one(params.to)}|${one(params.priority)}`;
  const [seenParams, setSeenParams] = useState(paramsKey);
  if (seenParams !== paramsKey) {
    setSeenParams(paramsKey);
    const next = { from: one(params.from), to: one(params.to) };
    if (next.to) {
      setTrip(next);
      setDraft(next);
    }
    if (isPriority(params.priority)) setPriority(params.priority);
  }

  // Default destination: the last trip's.
  useEffect(() => {
    if (trip.to) return;
    historyService.getTrips().then((trips) => {
      const last = trips[0]?.to;
      if (last) {
        setTrip((t) => (t.to ? t : { ...t, to: last }));
        setDraft((d) => (d.to ? d : { ...d, to: last }));
      }
    });
  }, [trip.to]);

  const activePriority = priority ?? prefs?.defaultPriority ?? 'fastest';
  const vehicles = prefs?.vehicles ?? ALL_VEHICLES;

  // Results are tagged with the trip they belong to, so a new trip shows the
  // loading state until its own results arrive.
  const tripKey = `${trip.from}|${trip.to}`;
  const [result, setResult] = useState<{ key: string; routes: Route[]; destination: Place } | null>(
    null,
  );
  const routes = result?.key === tripKey ? result.routes : null;
  const destination = result?.key === tripKey ? result.destination : null;

  // Fetch once per trip; priority and vehicle changes re-rank locally (instant).
  useEffect(() => {
    if (!trip.to) return;
    let live = true;
    (async () => {
      const [fromPlace, toPlace] = await Promise.all([
        trip.from ? routingService.geocode(trip.from) : null,
        routingService.geocode(trip.to),
      ]);
      if (!toPlace) return;
      const origin = fromPlace ?? useMapStore.getState().userLocation ?? fallbackOrigin;
      const found = await routingService.getRoutes(origin, toPlace, {
        priority: 'fastest',
        vehicles: ALL_VEHICLES,
      });
      if (live) setResult({ key: `${trip.from}|${trip.to}`, routes: found, destination: toPlace });
    })();
    return () => {
      live = false;
    };
  }, [trip]);

  const ranked = useMemo(
    () => (routes ? rankRoutes(routes, activePriority, vehicles) : []),
    [routes, activePriority, vehicles],
  );

  // The map follows the top route unless the user picked another card since
  // the last re-rank.
  const rankKey = `${tripKey}|${activePriority}|${vehicles.car}${vehicles.bike}${vehicles.cycle}`;
  const [picked, setPicked] = useState<{ key: string; id: string } | null>(null);
  const selectedId = picked?.key === rankKey ? picked.id : null;
  const mapSelection = selectedId ?? ranked[0]?.id ?? 'none';
  const mapContent = useMemo(
    () => ({
      routes: ranked.map((r) => ({ id: r.id, legs: r.legs })),
      selection: mapSelection,
      destination: destination
        ? { name: destination.name, location: destination.location }
        : undefined,
    }),
    [ranked, mapSelection, destination],
  );
  useMapContent('routes', mapContent);

  const fromLabel = trip.from || area || 'Current location';
  useTopBar('routes', {
    title: 'Routes',
    subtitle: trip.to ? `${fromLabel} → ${trip.to}` : 'Where to?',
    searchLabel: 'Edit From and To',
    onSearch: () => {
      sheet.setIndex(SHEET_FULL);
      setTimeout(() => fromRef.current?.focus(), 320);
    },
  });

  const submit = () => setTrip({ from: draft.from.trim(), to: draft.to.trim() });
  const swap = () => {
    const swapped = { from: draft.to, to: draft.from || fromLabel };
    setDraft(swapped);
    setTrip(swapped);
  };
  const setVehicle = (v: Vehicle, on: boolean) =>
    updatePrefs({ vehicles: { ...vehicles, [v]: on } });
  const resetFilters = () => updatePrefs({ vehicles: ALL_VEHICLES });

  const loading = routes === null && !!trip.to;

  return (
    <SheetScrollView gap={16}>
      <FromToCard
        from={draft.from}
        to={draft.to}
        onChangeFrom={(from) => setDraft((d) => ({ ...d, from }))}
        onChangeTo={(to) => setDraft((d) => ({ ...d, to }))}
        onSubmit={submit}
        onSwap={swap}
        fromRef={fromRef}
      />

      <View style={styles.group}>
        <RText variant="sectionLabel">What matters most?</RText>
        <View style={styles.chips} accessibilityRole="radiogroup">
          {PRIORITIES.map((p) => (
            <Chip
              key={p}
              label={priorityLabels[p]}
              selected={p === activePriority}
              onPress={() => setPriority(p)}
            />
          ))}
        </View>
      </View>

      <View style={styles.group}>
        <RText variant="sectionLabel">Include vehicles</RText>
        <View style={styles.tiles}>
          <ToggleTile
            label="Car"
            icon="car"
            value={vehicles.car}
            onValueChange={(on) => setVehicle('car', on)}
          />
          <ToggleTile
            label="Bike"
            icon="bike"
            value={vehicles.bike}
            onValueChange={(on) => setVehicle('bike', on)}
          />
          <ToggleTile
            label="Cycle"
            icon="cycle"
            value={vehicles.cycle}
            onValueChange={(on) => setVehicle('cycle', on)}
          />
        </View>
      </View>

      {loading ? (
        <>
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </>
      ) : !trip.to ? (
        <EmptyCard message="Enter a destination to see routes." />
      ) : ranked.length === 0 ? (
        <EmptyCard
          message="No routes match your filters"
          actionLabel="Reset filters"
          onAction={resetFilters}
        />
      ) : (
        <>
          <View style={styles.resultsHeader}>
            <RText
              variant="sectionTitle"
              size={18}
              accessibilityRole="header"
              accessibilityLiveRegion="polite"
            >
              {ranked.length === 1 ? '1 route found' : `${ranked.length} routes found`}
            </RText>
            <RText variant="caption">Ranked by AI · {priorityLabels[activePriority]}</RText>
          </View>
          {ranked.map((r) => (
            <Animated.View
              key={r.id}
              layout={LinearTransition.duration(250)}
              entering={FadeIn}
              exiting={FadeOut}
            >
              <RouteCard
                route={r}
                onPress={() => {
                  setPicked({ key: rankKey, id: r.id });
                  sheet.setIndex(SHEET_PEEK);
                  // TODO(route-detail): open the route detail screen (next to design).
                }}
              />
            </Animated.View>
          ))}
        </>
      )}
    </SheetScrollView>
  );
}

function EmptyCard({
  message,
  actionLabel,
  onAction,
}: {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.empty}>
      <RText variant="body" style={styles.center}>
        {message}
      </RText>
      {actionLabel && onAction && (
        <Pressable
          onPress={onAction}
          accessibilityRole="button"
          hitSlop={10}
          style={styles.emptyAction}
        >
          <RText variant="body" family={fonts.extrabold} color={colors.primary}>
            {actionLabel}
          </RText>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tiles: { flexDirection: 'row', gap: 8 },
  resultsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: 8,
  },
  empty: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 20,
    alignItems: 'center',
    gap: 8,
  },
  center: { textAlign: 'center' },
  emptyAction: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 12 },
});
