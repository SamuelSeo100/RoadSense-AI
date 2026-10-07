import { create } from 'zustand';

import type { TabName } from './tabs';

/**
 * Sheet snap points, bottom to top: collapsed (only the drag handle shows,
 * just above the nav bar), peek (≈51% of the screen) and full (below the top bar).
 */
export type SheetIndex = 0 | 1 | 2;
export const SHEET_COLLAPSED: SheetIndex = 0;
export const SHEET_PEEK: SheetIndex = 1;
export const SHEET_FULL: SheetIndex = 2;
export const isSheetIndex = (i: number): i is SheetIndex => i === 0 || i === 1 || i === 2;

export interface TopBarConfig {
  title: string;
  subtitle: string;
  /** Search button drawn solid (Home, Plan-a-route open). */
  searchActive: boolean;
  searchLabel: string;
  onSearch: () => void;
}

interface ShellState {
  topBar: Partial<Record<TabName, TopBarConfig>>;
  /** Each tab keeps its own sheet position. */
  sheetIndex: Record<TabName, SheetIndex>;
  /** Bumped to ask Home to focus its To field (other tabs' search buttons). */
  homeSearchRequest: number;
  toast: { id: number; message: string } | null;

  setTopBar: (tab: TabName, config: TopBarConfig) => void;
  setSheetIndex: (tab: TabName, index: SheetIndex) => void;
  requestHomeSearch: () => void;
  showToast: (message: string) => void;
  hideToast: () => void;
}

export const useShellStore = create<ShellState>()((set) => ({
  topBar: {},
  sheetIndex: { home: SHEET_PEEK, routes: SHEET_PEEK, history: SHEET_PEEK, profile: SHEET_PEEK },
  homeSearchRequest: 0,
  toast: null,

  setTopBar: (tab, config) => set((s) => ({ topBar: { ...s.topBar, [tab]: config } })),
  setSheetIndex: (tab, index) =>
    set((s) =>
      s.sheetIndex[tab] === index ? s : { sheetIndex: { ...s.sheetIndex, [tab]: index } },
    ),
  requestHomeSearch: () => set((s) => ({ homeSearchRequest: s.homeSearchRequest + 1 })),
  showToast: (message) => set({ toast: { id: Date.now(), message } }),
  hideToast: () => set({ toast: null }),
}));

/** Toast from anywhere (event handlers, services). */
export const showToast = (message: string) => useShellStore.getState().showToast(message);
