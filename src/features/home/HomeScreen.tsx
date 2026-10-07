import { useEffect, useMemo, useRef } from 'react';
import { type TextInput } from 'react-native';

import { aiService } from '@/services';
import { useAuthStore } from '@/store/authStore';
import { useRoutlyPrefs } from '@/store/routlyPrefsStore';

import { useMapStore, type MapContent } from '../map/mapStore';
import { goToRoutes, openRoutes } from '../routes/openRoutes';
import { SheetScrollView } from '../shell/SheetScrollView';
import { SHEET_FULL, showToast, useShellStore } from '../shell/shellStore';
import { useMapContent, useSheet, useTopBar } from '../shell/useScreenChrome';
import { book } from '../trip/booking';
import { DirectionsCard } from '../trip/DirectionsCard';
import { useTripStore } from '../trip/tripStore';

import { AiModeCard } from './components/AiModeCard';
import { TicketsGrid, type TicketTile } from './components/TicketsGrid';
import { firstName, timeOfDay } from './greeting';

/** Home keeps a clean map: just the user's dot. Routes are shown on the Routes tab. */
const CLEAN_MAP: MapContent = { routes: [], selection: 'none', focused: false };

export function HomeScreen() {
  const user = useAuthStore((s) => s.user);
  const prefs = useRoutlyPrefs((s) => s.prefs);
  const updatePrefs = useRoutlyPrefs((s) => s.update);
  const searchRequest = useShellStore((s) => s.homeSearchRequest);
  const sheet = useSheet('home');
  const toInputRef = useRef<TextInput>(null);

  // Search button on History / Profile lands here.
  useEffect(() => {
    if (searchRequest === 0) return;
    const t = setTimeout(() => toInputRef.current?.focus(), 320);
    return () => clearTimeout(t);
  }, [searchRequest]);

  useTopBar('home', {
    title: 'Routly',
    subtitle: `Good ${timeOfDay()}, ${firstName(user?.name)}`,
    searchLabel: 'Search for a destination',
    onSearch: () => {
      sheet.setIndex(SHEET_FULL);
      // After the sheet has expanded.
      setTimeout(() => toInputRef.current?.focus(), 320);
    },
  });

  useMapContent(
    'home',
    useMemo(() => CLEAN_MAP, []),
  );

  const submitAi = async (text: string) => {
    const parsed = await aiService.parseQuery(text);
    if (!parsed) {
      showToast('Try “Quickest way to Pune Station”');
      return;
    }
    await openRoutes({ to: parsed.to, priority: parsed.priority });
  };

  const openTicket = async (tile: TicketTile) => {
    const to = useTripStore.getState().to;
    const pickup = useMapStore.getState().userLocation ?? undefined;
    const trip = to ? { pickup, drop: { ...to.location, name: to.name } } : {};
    await book(tile === 'bike' ? 'bikeTaxi' : tile, trip);
  };

  return (
    <SheetScrollView>
      <DirectionsCard toInputRef={toInputRef} onPicked={goToRoutes} onError={showToast} />

      <AiModeCard
        enabled={prefs?.aiModeEnabled ?? true}
        onToggle={(aiModeEnabled) => updatePrefs({ aiModeEnabled })}
        showMic={prefs?.voiceForAiMode ?? true}
        // TODO(voice): speech-to-text (needs a native speech module + dev build).
        onMic={() => showToast('Voice coming soon')}
        onSubmit={submitAi}
      />

      <TicketsGrid onPress={openTicket} />
    </SheetScrollView>
  );
}
