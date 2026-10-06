import { router } from 'expo-router';

import type { Priority } from '@/services/types';

import { useShellStore } from '../shell/shellStore';

export interface RoutesParams {
  /** Omit for the current location. */
  from?: string;
  to: string;
  priority?: Priority;
}

/** Switches to the Routes tab for a trip (Home AI Mode / Find routes, History Repeat). */
export function openRoutes({ from, to, priority }: RoutesParams) {
  useShellStore.getState().setSheetIndex('routes', 0);
  router.navigate({
    pathname: '/routes',
    params: { to, ...(from ? { from } : { from: '' }), ...(priority ? { priority } : {}) },
  });
}

/** History/Profile search button: jump to Home with Plan-a-route open and the sheet expanded. */
export function openHomeSearch() {
  const shell = useShellStore.getState();
  shell.setHomeSearchOpen(true);
  shell.setSheetIndex('home', 1);
  router.navigate('/home');
}
