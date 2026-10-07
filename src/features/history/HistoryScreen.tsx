import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { RText } from '@/components/routly/RText';
import { historyService, type MonthlyStats, type Trip } from '@/services';
import { colors, radius } from '@/theme/routly';

import { openHomeSearch, openRoutes } from '../routes/openRoutes';
import { SheetScrollView } from '../shell/SheetScrollView';
import { SHEET_PEEK } from '../shell/shellStore';
import { useMapContent, useSheet, useTopBar } from '../shell/useScreenChrome';

import { ModeMixCard } from './components/ModeMixCard';
import { StatsGrid } from './components/StatsGrid';
import { TripRow } from './components/TripRow';

/** Trips grouped by their day label, keeping the service's order. */
function groupByDay(trips: Trip[]) {
  const groups: { day: string; trips: Trip[] }[] = [];
  for (const trip of trips) {
    const last = groups[groups.length - 1];
    if (last?.day === trip.dayLabel) last.trips.push(trip);
    else groups.push({ day: trip.dayLabel, trips: [trip] });
  }
  return groups;
}

export function HistoryScreen() {
  const sheet = useSheet('history');
  const [trips, setTrips] = useState<Trip[] | null>(null);
  const [stats, setStats] = useState<MonthlyStats | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useTopBar('history', {
    title: 'History',
    subtitle: 'Tap a trip to see it on the map',
    searchLabel: 'Plan a route',
    onSearch: openHomeSearch,
  });

  useEffect(() => {
    historyService.getTrips().then(setTrips);
    historyService.getMonthlyStats().then(setStats);
  }, []);

  // Nothing on the map until the user taps a trip.
  const selected = trips?.find((t) => t.id === selectedId);
  const mapContent = useMemo(() => {
    const end = selected?.path?.[selected.path.length - 1];
    return {
      routes: selected
        ? [
            {
              id: selected.id,
              legs: [
                {
                  mode: selected.mode,
                  label: selected.modeLabel,
                  durationMin: selected.durationMin,
                  polyline: selected.path,
                },
              ],
            },
          ]
        : [],
      selection: selected?.id ?? 'none',
      focused: selectedId !== null,
      destination: selected && end ? { name: selected.to, location: end } : undefined,
    };
  }, [selected, selectedId]);
  useMapContent('history', mapContent);

  const groups = useMemo(() => groupByDay(trips ?? []), [trips]);

  return (
    <SheetScrollView gap={16}>
      {stats && <StatsGrid stats={stats} />}
      {stats && <ModeMixCard mix={stats.modeMix} />}

      {trips && trips.length === 0 && (
        <View style={styles.empty}>
          <RText variant="body" style={styles.center}>
            No trips yet. Your journeys will show up here.
          </RText>
        </View>
      )}

      {groups.map((g) => (
        <View key={g.day} style={styles.group}>
          <RText variant="fieldLabel" size={12} accessibilityRole="header">
            {g.day}
          </RText>
          {g.trips.map((trip) => (
            <TripRow
              key={trip.id}
              trip={trip}
              selected={trip.id === selected?.id}
              onPress={() => {
                setSelectedId(trip.id);
                sheet.setIndex(SHEET_PEEK);
              }}
              onRepeat={() => openRoutes({ from: trip.from, to: trip.to })}
            />
          ))}
        </View>
      ))}
    </SheetScrollView>
  );
}

const styles = StyleSheet.create({
  group: { gap: 8 },
  empty: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 20,
  },
  center: { textAlign: 'center' },
});
