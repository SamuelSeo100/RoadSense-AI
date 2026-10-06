import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';

import { PrimaryButton } from '@/components/routly/PrimaryButton';
import { PREVIEW_CARD_WIDTH, RoutePreviewCard } from '@/components/routly/RoutePreviewCard';
import { RText } from '@/components/routly/RText';
import { SectionHeader } from '@/components/routly/SectionHeader';
import { SkeletonCard } from '@/components/routly/SkeletonCard';
import { choose } from '@/lib/confirm';
import {
  aiService,
  fallbackOrigin,
  historyService,
  routingService,
  type Place,
  type Route,
} from '@/services';
import { openBooking, type BookingProvider } from '@/services/bookings';
import { useAuthStore } from '@/store/authStore';
import { useRoutlyPrefs } from '@/store/routlyPrefsStore';
import { colors, fonts, spacing } from '@/theme/routly';

import { useMapStore } from '../map/mapStore';
import { openRoutes } from '../routes/openRoutes';
import { SheetScrollView } from '../shell/SheetScrollView';
import { SHEET_FULL, showToast, useShellStore } from '../shell/shellStore';
import { useMapContent, useSheet, useTopBar } from '../shell/useScreenChrome';

import { AiModeCard } from './components/AiModeCard';
import { PlanRoutePanel } from './components/PlanRoutePanel';
import { TicketsGrid, type TicketTile } from './components/TicketsGrid';
import { firstName, timeOfDay } from './greeting';

const DEFAULT_DESTINATION = 'Pune Station';

/** Most frequent destination in the user's history. */
async function usualDestination() {
  const trips = await historyService.getTrips();
  const counts = new Map<string, number>();
  for (const t of trips) counts.set(t.to, (counts.get(t.to) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? DEFAULT_DESTINATION;
}

export function HomeScreen() {
  const user = useAuthStore((s) => s.user);
  const prefs = useRoutlyPrefs((s) => s.prefs);
  const updatePrefs = useRoutlyPrefs((s) => s.update);
  const userLocation = useMapStore((s) => s.userLocation);
  const area = useMapStore((s) => s.area);
  const searchOpen = useShellStore((s) => s.homeSearchOpen);
  const setSearchOpen = useShellStore((s) => s.setHomeSearchOpen);
  const sheet = useSheet('home');

  const [destination, setDestination] = useState<Place | null>(null);
  const [previews, setPreviews] = useState<Route[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useTopBar('home', {
    title: 'Routly',
    subtitle: `Good ${timeOfDay()}, ${firstName(user?.name)}`,
    searchActive: searchOpen,
    searchLabel: searchOpen ? 'Close route search' : 'Plan a route',
    onSearch: () => {
      const next = !searchOpen;
      setSearchOpen(next);
      if (next) sheet.setIndex(SHEET_FULL);
    },
  });

  // Previews to the usual destination. The origin is read once: GPS jitter shouldn't reload them.
  const hasLocation = userLocation !== null;
  useEffect(() => {
    let live = true;
    (async () => {
      const name = await usualDestination();
      const to = await routingService.geocode(name);
      if (!to || !live) return;
      const from = useMapStore.getState().userLocation ?? fallbackOrigin;
      const routes = await routingService.getPreview(from, to);
      if (!live) return;
      setDestination(to);
      setPreviews(routes);
      setSelectedId((id) => id ?? routes[0]?.id ?? null);
    })();
    return () => {
      live = false;
    };
  }, [hasLocation]);

  const mapContent = useMemo(
    () => ({
      routes: (previews ?? []).map((r) => ({ id: r.id, legs: r.legs })),
      selection: selectedId ?? 'none',
      destination: destination
        ? { name: destination.name, location: destination.location }
        : undefined,
    }),
    [previews, selectedId, destination],
  );
  useMapContent('home', mapContent);

  const selected = previews?.find((r) => r.id === selectedId);
  const savedPlaces = prefs?.savedPlaces ?? [];

  const submitAi = async (text: string) => {
    const parsed = await aiService.parseQuery(text);
    if (!parsed) {
      showToast('Try “Quickest way to Pune Station”');
      return;
    }
    const saved = savedPlaces.find((p) => p.label.toLowerCase() === parsed.to.toLowerCase());
    openRoutes({ to: saved?.place?.name ?? parsed.to, priority: parsed.priority });
  };

  const openTicket = async (tile: TicketTile) => {
    const trip = destination
      ? {
          pickup: userLocation ?? undefined,
          drop: { ...destination.location, name: destination.name },
        }
      : {};
    let provider: BookingProvider | null;
    if (tile === 'cab') {
      provider = await choose('Book a cab with', [
        { value: 'uber', label: 'Uber' },
        { value: 'ola', label: 'Ola' },
      ]);
    } else {
      provider = tile === 'metro' ? 'puneMetro' : tile === 'bus' ? 'pmpml' : 'rapido';
    }
    if (provider && !(await openBooking(provider, trip)))
      showToast('Couldn’t open the partner app');
  };

  return (
    <SheetScrollView>
      <AiModeCard
        enabled={prefs?.aiModeEnabled ?? true}
        onToggle={(aiModeEnabled) => updatePrefs({ aiModeEnabled })}
        showMic={prefs?.voiceForAiMode ?? true}
        // TODO(voice): speech-to-text (needs a native speech module + dev build).
        onMic={() => showToast('Voice coming soon')}
        onSubmit={submitAi}
      />

      {searchOpen && (
        <PlanRoutePanel
          currentLocationLabel={`Current location · ${area ?? 'Pimpri'}`}
          savedPlaces={savedPlaces}
          onClose={() => setSearchOpen(false)}
          onFind={(from, to) => openRoutes({ from, to })}
        />
      )}

      <View style={styles.section}>
        <SectionHeader
          title={`Routes to ${destination?.name ?? '…'}`}
          right={
            <Pressable
              onPress={() => destination && openRoutes({ to: destination.name })}
              accessibilityRole="link"
              accessibilityLabel="See all routes"
              hitSlop={12}
            >
              <RText variant="body" size={13} family={fonts.bold} color={colors.primary}>
                See all
              </RText>
            </Pressable>
          }
        />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.bleed}
          contentContainerStyle={styles.previewList}
        >
          {previews
            ? previews.map((r) => (
                <RoutePreviewCard
                  key={r.id}
                  route={r}
                  selected={r.id === selectedId}
                  onPress={() => setSelectedId(r.id)}
                />
              ))
            : [0, 1].map((i) => (
                <View key={i} style={{ width: PREVIEW_CARD_WIDTH }}>
                  <SkeletonCard />
                </View>
              ))}
        </ScrollView>
        <PrimaryButton
          label={selected ? `Start journey · ${selected.name}` : 'Start journey'}
          trailingIcon="arrow-right"
          // TODO(navigation): turn-by-turn journey screen.
          onPress={() => showToast('Live navigation is coming soon')}
        />
      </View>

      <TicketsGrid onPress={openTicket} />
    </SheetScrollView>
  );
}

const styles = StyleSheet.create({
  section: { gap: 12 },
  bleed: { marginHorizontal: -spacing.screen },
  previewList: { paddingHorizontal: spacing.screen, paddingVertical: 8, gap: 10 },
});
