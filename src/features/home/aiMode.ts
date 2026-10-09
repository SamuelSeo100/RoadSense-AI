import { aiService, type AiContext, type AiQuery } from '@/services';
import { useRoutlyPrefs } from '@/store/routlyPrefsStore';

import { useMapStore } from '../map/mapStore';
import { currentSavedPlaces, isSet } from '../places/savedPlaces';
import { openRoutes } from '../routes/openRoutes';
import { showToast } from '../shell/shellStore';

/** An inline follow-up question under the AI Mode box. */
export interface AiClarify {
  question: string;
  /** 2–3 destinations to tap. */
  options: string[];
  /** The rest of the parse (priority, modes, time) applies to the picked option. */
  base: AiQuery;
}

function context(): AiContext {
  const prefs = useRoutlyPrefs.getState().prefs;
  return {
    savedPlaces: currentSavedPlaces().map((p) => ({
      label: p.label,
      name: p.place?.name,
    })),
    area: useMapStore.getState().area ?? undefined,
    learnFromTrips: prefs?.learnFromTrips ?? true,
  };
}

const futureDate = (iso?: string) => {
  const t = iso ? Date.parse(iso) : NaN;
  return Number.isFinite(t) && t > Date.now() ? new Date(t) : undefined;
};

/** Plans the parsed trip and shows Routes. */
export async function applyAiQuery(query: AiQuery & { to: string }) {
  // TODO(routing): arriveBy. The Routes API takes arrivalTime for TRANSIT only
  // (not with departureTime, and not for drive/two-wheeler/walk), so honouring
  // it needs a transit-only request plus back-computed road departures.
  if (query.arriveBy && !query.departAt) {
    showToast('Arrive-by times aren’t supported yet. Showing routes leaving now.');
  }
  await openRoutes({
    from: query.from,
    to: query.to,
    priority: query.priority,
    departAt: futureDate(query.departAt),
    modeFilter: query.modes,
  });
}

/** Free text → parse → Routes, or a clarify question (null when it planned or failed). */
export async function runAiQuery(text: string): Promise<AiClarify | null> {
  await useRoutlyPrefs.getState().hydrate();
  const query = await aiService.parseQuery(text, context());
  if (!query) {
    showToast('Try “Quickest way to Pune Station”');
    return null;
  }
  if (query.to) {
    await applyAiQuery({ ...query, to: query.to });
    return null;
  }
  const saved = currentSavedPlaces()
    .filter(isSet)
    .map((p) => p.label);
  const options = (query.clarifyOptions?.length ? query.clarifyOptions : saved).slice(0, 3);
  return { question: query.clarify ?? 'Where do you want to go?', options, base: query };
}
