import { useEffect, useMemo, useRef, useState } from 'react';
import { Keyboard, Pressable, StyleSheet, View, type TextInput } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { Chip } from '@/components/routly/Chip';
import { RouteCard } from '@/components/routly/RouteCard';
import { RText } from '@/components/routly/RText';
import { SkeletonCard } from '@/components/routly/SkeletonCard';
import { PRIORITIES, priorityLabels, type RankedRoute, type Vehicle } from '@/services';
import { useRoutlyPrefs } from '@/store/routlyPrefsStore';
import { colors, fonts, radius } from '@/theme/routly';

import { useMapStore, type MapContent } from '../map/mapStore';
import { SheetScrollView } from '../shell/SheetScrollView';
import { SHEET_FULL, SHEET_PEEK, showToast } from '../shell/shellStore';
import { useMapContent, useSheet, useTopBar } from '../shell/useScreenChrome';
import { DirectionsCard } from '../trip/DirectionsCard';
import { modeFilterLabel } from '../trip/modeFilter';
import { logChoice, startTrip } from '../trip/tripLog';
import { shownRoutes, useTripStore } from '../trip/tripStore';

import { RouteNotices } from './components/RouteNotices';
import { RouteSteps } from './components/RouteSteps';

const CLEAN_MAP: MapContent = { routes: [], selection: 'none', focused: false };
const NO_VEHICLES: Record<Vehicle, boolean> = { car: false, bike: false, cycle: false };

/**
 * Ways to get to the planned destination: priority chips, notices and the
 * ranked route cards. Changing priority re-ranks locally (no refetch). The
 * selected card is the only route drawn on the map.
 */
export function RoutesScreen() {
  const from = useTripStore((s) => s.from);
  const to = useTripStore((s) => s.to);
  const state = useTripStore((s) => s.routes);
  const retry = useTripStore((s) => s.retry);
  const priority = useTripStore((s) => s.priority);
  const setPriority = useTripStore((s) => s.setPriority);
  const modeFilter = useTripStore((s) => s.modeFilter);
  const clearModeFilter = useTripStore((s) => s.clearModeFilter);
  const departAt = useTripStore((s) => s.departAt);
  const vehicles = useRoutlyPrefs((s) => s.prefs?.vehicles) ?? NO_VEHICLES;
  const area = useMapStore((s) => s.area);
  const sheet = useSheet('routes');
  const toInputRef = useRef<TextInput>(null);

  const fromLabel = from.kind === 'current' ? 'Your location' : from.place.name;
  useTopBar('routes', {
    title: 'Routes',
    subtitle: to ? `${fromLabel} → ${to.name}` : 'Where to?',
    searchLabel: 'Edit From and To',
    onSearch: () => {
      sheet.setIndex(SHEET_FULL);
      setTimeout(() => toInputRef.current?.focus(), 320);
    },
  });

  const ready = state.status === 'ready' ? state : null;
  const ranked = useMemo(
    () => (ready ? shownRoutes(ready.routes, priority, vehicles, modeFilter) : []),
    [ready, priority, vehicles, modeFilter],
  );

  // The user's pick, valid for the result it was made on. Until they tap, the
  // top-ranked route is shown without moving the camera (`focused` false).
  const [picked, setPicked] = useState<{ requestId: string; id: string; open: boolean } | null>(
    null,
  );
  const userPick =
    ready && picked?.requestId === ready.requestId && ranked.some((r) => r.id === picked.id)
      ? picked
      : null;
  const selected = ranked.find((r) => r.id === userPick?.id) ?? ranked[0] ?? null;

  const mapContent = useMemo<MapContent>(
    () =>
      selected && to
        ? {
            routes: [{ id: selected.id, legs: selected.legs }],
            selection: selected.id,
            focused: userPick !== null,
            plain: selected.legs.every((l) => l.mode === 'walk'),
            destination: { name: to.name, location: to.location },
          }
        : CLEAN_MAP,
    [selected, userPick, to],
  );
  useMapContent('routes', mapContent);

  // A *new* result: show the map once (peek). Re-ranks don't move the sheet.
  const setSheetIndex = sheet.setIndex;
  const requestId = ready?.requestId;
  useEffect(() => {
    if (requestId === undefined) return;
    Keyboard.dismiss();
    setSheetIndex(SHEET_PEEK);
  }, [requestId, setSheetIndex]);

  const onCardPress = (route: RankedRoute) => {
    if (!ready) return;
    // Tapping the open card folds it; any other card is selected and opened.
    const same = userPick?.id === route.id;
    const opening = !same || !userPick.open;
    setPicked({ requestId: ready.requestId, id: route.id, open: opening });
    if (opening) logChoice(ready.requestId, route, priority, 'expand');
  };

  const onStart = (route: RankedRoute) => {
    if (!ready || !to) return;
    logChoice(ready.requestId, route, priority, 'start');
    // The cab estimate for the same trip, for "saved vs cab" in History.
    const cab = ready.routes.find((r) => r.mapKey === 'cab' && !r.vehicle);
    startTrip({
      requestId: ready.requestId,
      at: new Date(),
      from: fromLabel === 'Your location' ? (area ?? 'Current location') : fromLabel,
      to: to.name,
      route,
      cabEquivalentInr: cab?.costInr ?? null,
    });
    // TODO(navigation): turn-by-turn guidance.
    showToast('Live navigation is coming soon');
  };

  const priorityLabel = priorityLabels[priority];

  return (
    <SheetScrollView gap={16}>
      <DirectionsCard toInputRef={toInputRef} onError={showToast} />

      {!to && <Notice text="Search for a destination to see ways to get there." />}

      {to && state.status !== 'error' && (
        <View style={styles.group}>
          <RText variant="sectionLabel">What matters most?</RText>
          <View style={styles.chips} accessibilityRole="radiogroup">
            {PRIORITIES.map((p) => (
              <Chip
                key={p}
                label={priorityLabels[p]}
                selected={p === priority}
                onPress={() => setPriority(p)}
              />
            ))}
          </View>
          {modeFilter && (
            <View style={styles.chips}>
              <Chip
                label={`${modeFilterLabel(modeFilter)} ✕`}
                height={36}
                selected
                accessibilityLabel={`Filter: ${modeFilterLabel(modeFilter)}. Remove filter`}
                onPress={clearModeFilter}
              />
            </View>
          )}
        </View>
      )}

      {to && state.status === 'loading' && (
        <View style={styles.list}>
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </View>
      )}

      {to && state.status === 'error' && (
        <Notice text={state.message} actionLabel="Retry" onAction={retry} />
      )}

      {to && ready && (
        <>
          <RouteNotices notices={ready.notices} />
          {ranked.length === 0 ? (
            <Notice
              text={
                modeFilter && ready.routes.length > 0
                  ? `No routes match “${modeFilterLabel(modeFilter)}”.`
                  : ready.notices.some((n) => n.kind === 'partialFailure')
                    ? 'Couldn’t load routes. Check your connection and try again.'
                    : 'No routes found for this trip.'
              }
              actionLabel={modeFilter && ready.routes.length > 0 ? 'Show all routes' : 'Retry'}
              onAction={modeFilter && ready.routes.length > 0 ? clearModeFilter : retry}
            />
          ) : (
            <>
              <View style={styles.header}>
                <RText variant="sectionTitle" size={18} accessibilityRole="header">
                  {ranked.length === 1 ? '1 route found' : `${ranked.length} routes found`}
                </RText>
                <RText variant="caption">
                  Ranked for {priorityLabel}
                  {departAt ? ` · leaving ${leaveLabel(departAt)}` : ''}
                </RText>
              </View>
              <View style={styles.list}>
                {ranked.map((route) => {
                  const isSelected = route.id === selected?.id;
                  const open = isSelected && userPick?.open === true;
                  return (
                    // No `layout` transition: on Android (Fabric) it left the next card
                    // overlapping when a card above expanded.
                    <Animated.View key={route.id} entering={FadeIn.duration(180)}>
                      <RouteCard
                        route={route}
                        priorityLabel={priorityLabel}
                        selected={isSelected}
                        onPress={() => onCardPress(route)}
                      >
                        {open ? (
                          <RouteSteps
                            route={route}
                            originLabel={fromLabel}
                            destinationName={to.name}
                            walk={ready.walk}
                            onBook={(action) => logChoice(ready.requestId, route, priority, action)}
                            onStart={() => onStart(route)}
                          />
                        ) : undefined}
                      </RouteCard>
                    </Animated.View>
                  );
                })}
              </View>
            </>
          )}
        </>
      )}
    </SheetScrollView>
  );
}

/** "6:30 PM", or "Sat 8:00 AM" when not today (device time zone). */
function leaveLabel(at: Date): string {
  const time = at.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
  const today = new Date().toDateString() === at.toDateString();
  return today ? time : `${at.toLocaleDateString('en-IN', { weekday: 'short' })} ${time}`;
}

function Notice({
  text,
  actionLabel,
  onAction,
}: {
  text: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.notice}>
      <RText variant="body" style={styles.center}>
        {text}
      </RText>
      {actionLabel && onAction && (
        <Pressable onPress={onAction} accessibilityRole="button" hitSlop={10} style={styles.action}>
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    flexWrap: 'wrap',
    gap: 8,
  },
  list: { gap: 16 },
  notice: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 20,
    alignItems: 'center',
    gap: 8,
  },
  center: { textAlign: 'center' },
  action: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 12 },
});
