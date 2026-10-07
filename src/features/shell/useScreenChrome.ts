import { useCallback, useEffect, useRef } from 'react';

import { useMapStore, type MapContent } from '../map/mapStore';

import { useShellStore, type SheetIndex } from './shellStore';
import type { TabName } from './tabs';

interface TopBarInput {
  title: string;
  subtitle: string;
  searchActive?: boolean;
  searchLabel?: string;
  onSearch: () => void;
}

/** Registers this tab's top bar (title, subtitle, search behaviour) with the shell. */
export function useTopBar(
  tab: TabName,
  { title, subtitle, searchActive = false, searchLabel = 'Search routes', onSearch }: TopBarInput,
) {
  const setTopBar = useShellStore((s) => s.setTopBar);
  const onSearchRef = useRef(onSearch);
  useEffect(() => {
    onSearchRef.current = onSearch;
  });
  useEffect(() => {
    setTopBar(tab, {
      title,
      subtitle,
      searchActive,
      searchLabel,
      onSearch: () => onSearchRef.current(),
    });
  }, [setTopBar, tab, title, subtitle, searchActive, searchLabel]);
}

/** Registers what the shared map shows for this tab. Pass a memoised object. */
export function useMapContent(tab: TabName, content: MapContent) {
  const setContent = useMapStore((s) => s.setContent);
  useEffect(() => {
    setContent(tab, content);
  }, [setContent, tab, content]);
}

/**
 * This tab's sheet position, and a setter that snaps the shared sheet. The
 * setter is stable, so effects depending on it don't re-run on every render.
 */
export function useSheet(tab: TabName) {
  const index = useShellStore((s) => s.sheetIndex[tab]);
  const setSheetIndex = useShellStore((s) => s.setSheetIndex);
  const setIndex = useCallback((i: SheetIndex) => setSheetIndex(tab, i), [setSheetIndex, tab]);
  return { index, setIndex } as const;
}
