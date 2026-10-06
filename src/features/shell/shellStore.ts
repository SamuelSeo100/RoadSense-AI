import { create } from 'zustand';

import type { TabName } from './tabs';

export type SheetIndex = 0 | 1;
export const SHEET_PEEK: SheetIndex = 0;
export const SHEET_FULL: SheetIndex = 1;

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
  /** Home's Plan-a-route panel (opened from other tabs' search buttons too). */
  homeSearchOpen: boolean;
  toast: { id: number; message: string } | null;

  setTopBar: (tab: TabName, config: TopBarConfig) => void;
  setSheetIndex: (tab: TabName, index: SheetIndex) => void;
  setHomeSearchOpen: (open: boolean) => void;
  showToast: (message: string) => void;
  hideToast: () => void;
}

export const useShellStore = create<ShellState>()((set) => ({
  topBar: {},
  sheetIndex: { home: SHEET_PEEK, routes: SHEET_PEEK, history: SHEET_PEEK, profile: SHEET_PEEK },
  homeSearchOpen: false,
  toast: null,

  setTopBar: (tab, config) => set((s) => ({ topBar: { ...s.topBar, [tab]: config } })),
  setSheetIndex: (tab, index) =>
    set((s) =>
      s.sheetIndex[tab] === index ? s : { sheetIndex: { ...s.sheetIndex, [tab]: index } },
    ),
  setHomeSearchOpen: (open) => set({ homeSearchOpen: open }),
  showToast: (message) => set({ toast: { id: Date.now(), message } }),
  hideToast: () => set({ toast: null }),
}));

/** Toast from anywhere (event handlers, services). */
export const showToast = (message: string) => useShellStore.getState().showToast(message);
