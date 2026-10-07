import { useEffect, useMemo, useRef } from 'react';
import { Keyboard, Pressable, StyleSheet, View, type TextInput } from 'react-native';

import { RText } from '@/components/routly/RText';
import { SkeletonCard } from '@/components/routly/SkeletonCard';
import { colors, fonts, radius } from '@/theme/routly';

import type { MapContent } from '../map/mapStore';
import { SheetScrollView } from '../shell/SheetScrollView';
import { SHEET_FULL, SHEET_PEEK, showToast } from '../shell/shellStore';
import { useMapContent, useSheet, useTopBar } from '../shell/useScreenChrome';
import { DirectionsCard } from '../trip/DirectionsCard';
import { useTripStore } from '../trip/tripStore';

import { WalkingOptionCard } from './components/WalkingOptionCard';

const CLEAN_MAP: MapContent = { routes: [], selection: 'none', focused: false };

/**
 * Ways to get to the planned destination. For now only walking is fetched;
 * more options (metro, bus, cab…) will join this list.
 */
export function RoutesScreen() {
  const from = useTripStore((s) => s.from);
  const to = useTripStore((s) => s.to);
  const route = useTripStore((s) => s.route);
  const retry = useTripStore((s) => s.retry);
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

  const walk = route.status === 'ready' ? route.route : null;
  const mapContent = useMemo<MapContent>(
    () =>
      walk && to
        ? {
            routes: [
              {
                id: 'walk',
                legs: [
                  {
                    mode: 'walk',
                    label: 'Walk',
                    durationMin: Math.round(walk.durationSec / 60),
                    polyline: walk.path,
                  },
                ],
              },
            ],
            selection: 'walk',
            focused: true,
            plain: true,
            destination: { name: to.name, location: to.location },
          }
        : CLEAN_MAP,
    [walk, to],
  );
  useMapContent('routes', mapContent);

  // A *new* route: show it on the map once (peek). Afterwards the sheet stays
  // wherever the user drags it.
  const setSheetIndex = sheet.setIndex;
  useEffect(() => {
    if (!walk) return;
    Keyboard.dismiss();
    setSheetIndex(SHEET_PEEK);
  }, [walk, setSheetIndex]);

  const count = walk ? 1 : 0;

  return (
    <SheetScrollView gap={16}>
      <DirectionsCard toInputRef={toInputRef} onError={showToast} />

      {!to && <Notice text="Search for a destination to see ways to get there." />}

      {to && route.status === 'loading' && <SkeletonCard />}

      {to && route.status === 'error' && (
        <Notice text={route.message} actionLabel="Retry" onAction={retry} />
      )}

      {walk && (
        <>
          <View style={styles.header}>
            <RText variant="sectionTitle" size={18} accessibilityRole="header">
              Ways to get there
            </RText>
            <RText variant="caption">{count === 1 ? '1 option' : `${count} options`}</RText>
          </View>
          <WalkingOptionCard
            route={walk}
            // TODO(navigation): turn-by-turn walking guidance.
            onStart={() => showToast('Live navigation is coming soon')}
          />
          <RText variant="caption">Metro, bus, auto and cab options are coming soon.</RText>
        </>
      )}
    </SheetScrollView>
  );
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
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
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
