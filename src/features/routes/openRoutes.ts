import { router } from 'expo-router';

import type { Priority } from '@/services/types';

import { SHEET_FULL, SHEET_PEEK, showToast, useShellStore } from '../shell/shellStore';
import { useTripStore, type PlanResult } from '../trip/tripStore';

export interface RoutesParams {
  /** Omit for the current location. */
  from?: string;
  to: string;
  /** Ranking to show (AI Mode: "cheapest to college"). */
  priority?: Priority;
}

/** Shows the Routes tab for the trip already in the trip store. */
export function goToRoutes() {
  useShellStore.getState().setSheetIndex('routes', SHEET_PEEK);
  router.navigate('/routes');
}

/** Plans a trip from free text (AI Mode, History "Repeat") and shows Routes. */
export async function openRoutes({ from, to, priority }: RoutesParams) {
  if (priority) useTripStore.getState().setPriority(priority);
  const result = await useTripStore
    .getState()
    .plan(to, from)
    .catch((): PlanResult => ({ ok: false, reason: 'notFound', text: to }));
  if (!result.ok) {
    showToast(
      result.reason === 'unsetSaved'
        ? `Set your ${result.label} address in Profile › Saved places`
        : `Couldn’t find “${result.text}”`,
    );
    return false;
  }
  goToRoutes();
  return true;
}

/** History/Profile search button: jump to Home with the sheet expanded and To focused. */
export function openHomeSearch() {
  const shell = useShellStore.getState();
  shell.setSheetIndex('home', SHEET_FULL);
  shell.requestHomeSearch();
}
