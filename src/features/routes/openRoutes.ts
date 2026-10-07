import { router } from 'expo-router';

import type { Priority } from '@/services/types';

import { SHEET_FULL, SHEET_PEEK, showToast, useShellStore } from '../shell/shellStore';
import { useTripStore } from '../trip/tripStore';

export interface RoutesParams {
  /** Omit for the current location. */
  from?: string;
  to: string;
  /** Reserved for multi-modal ranking (only walking is fetched for now). */
  priority?: Priority;
}

/** Shows the Routes tab for the trip already in the trip store. */
export function goToRoutes() {
  useShellStore.getState().setSheetIndex('routes', SHEET_PEEK);
  router.navigate('/routes');
}

/** Plans a trip from free text (AI Mode, History "Repeat") and shows Routes. */
export async function openRoutes({ from, to }: RoutesParams) {
  const found = await useTripStore
    .getState()
    .plan(to, from)
    .catch(() => false);
  if (!found) {
    showToast(`Couldn’t find “${to}”`);
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
