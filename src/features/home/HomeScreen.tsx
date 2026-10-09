import { useEffect, useMemo, useRef, useState } from 'react';
import { type TextInput } from 'react-native';

import { useAuthStore } from '@/store/authStore';
import { useRoutlyPrefs } from '@/store/routlyPrefsStore';

import { useMapStore, type MapContent } from '../map/mapStore';
import { SavedPlaceChips } from '../places/SavedPlaceChips';
import { goToRoutes } from '../routes/openRoutes';
import { SheetScrollView } from '../shell/SheetScrollView';
import { SHEET_FULL, showToast, useShellStore } from '../shell/shellStore';
import { useMapContent, useSheet, useTopBar } from '../shell/useScreenChrome';
import { book } from '../trip/booking';
import { DirectionsCard } from '../trip/DirectionsCard';
import { useTripStore } from '../trip/tripStore';

import { applyAiQuery, runAiQuery, type AiClarify } from './aiMode';
import { AiModeCard } from './components/AiModeCard';
import { useVoiceInput } from './useVoiceInput';
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
  const [aiBusy, setAiBusy] = useState(false);
  const [clarify, setClarify] = useState<AiClarify | null>(null);
  const [aiText, setAiText] = useState('');
  const voiceOn = prefs?.voiceForAiMode ?? true;

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
    setClarify(null);
    setAiBusy(true);
    try {
      setClarify(await runAiQuery(text));
    } finally {
      setAiBusy(false);
    }
  };

  const voice = useVoiceInput({
    onTranscript: setAiText,
    onDone: (text) => {
      setAiText(text);
      void submitAi(text);
    },
    onError: showToast,
  });

  const pickClarify = async (option: string) => {
    if (!clarify) return;
    const { base } = clarify;
    setClarify(null);
    await applyAiQuery({ ...base, to: option, clarify: undefined });
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

      <SavedPlaceChips
        onGo={(place) => {
          useTripStore.getState().pickTo(place);
          goToRoutes();
        }}
      />

      <AiModeCard
        enabled={prefs?.aiModeEnabled ?? true}
        onToggle={(aiModeEnabled) => updatePrefs({ aiModeEnabled })}
        text={aiText}
        onChangeText={setAiText}
        showMic={voiceOn}
        listening={voice.listening}
        micStarting={voice.starting}
        onMic={voice.toggle}
        onSubmit={submitAi}
        busy={aiBusy}
        clarify={clarify}
        onClarifyPick={pickClarify}
      />

      <TicketsGrid onPress={openTicket} />
    </SheetScrollView>
  );
}
