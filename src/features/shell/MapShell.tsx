import BottomSheet, { useBottomSheetTimingConfigs } from '@gorhom/bottom-sheet';
import { router, usePathname } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Easing } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LiveMap } from '@/features/map/LiveMap';
import { MapOverlays } from '@/features/map/MapOverlays';
import { useMapStore } from '@/features/map/mapStore';
import { useUserLocation } from '@/features/map/useUserLocation';
import { useRoutlyPrefs } from '@/store/routlyPrefsStore';
import { colors, layout, radius, shadows } from '@/theme/routly';

import { FloatingNavBar } from './FloatingNavBar';
import { HANDLE_HEIGHT, SheetHandle } from './SheetHandle';
import {
  isSheetIndex,
  SHEET_COLLAPSED,
  SHEET_FULL,
  SHEET_PEEK,
  showToast,
  useShellStore,
} from './shellStore';
import { tabFromPath, tabInfo, type TabName } from './tabs';
import { Toast } from './Toast';
import { TopBar } from './TopBar';

/**
 * Signed-in shell shared by every tab, back to front: one persistent LiveMap
 * and its overlays → the draggable sheet (hosting the tab navigator) → TopBar →
 * floating nav bar → toast. Tabs only render sheet content and register their
 * top bar and map content (see useScreenChrome).
 */
export function MapShell({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const window = useWindowDimensions();
  const [height, setHeight] = useState(window.height);
  /**
   * The sheet mounts only once the real container height is known: changing
   * snap points under a mounted sheet (Android edge-to-edge) made it report
   * the collapsed index at startup.
   */
  const [measured, setMeasured] = useState(false);
  const tab = tabFromPath(usePathname());

  const topBarBottom = insets.top + layout.topBarHeight;
  const peekTop = Math.round(height * layout.sheetPeekTopRatio);
  // Collapsed: only the drag handle shows, sitting just above the floating nav bar.
  const collapsedHeight =
    insets.bottom + layout.navBar.bottomOffset + layout.navBar.height + 8 + HANDLE_HEIGHT;
  const snapPoints = useMemo(
    () => [collapsedHeight, height - peekTop, height - topBarBottom],
    [collapsedHeight, height, peekTop, topBarBottom],
  );

  const topBar = useShellStore((s) => s.topBar[tab]);
  const sheetIndex = useShellStore((s) => s.sheetIndex[tab]);
  const setSheetIndex = useShellStore((s) => s.setSheetIndex);
  const mapContent = useMapStore((s) => s.content[tab]);
  const userLocation = useMapStore((s) => s.userLocation);
  const { status: locationStatus, retry: enableLocation } = useUserLocation();

  const hydratePrefs = useRoutlyPrefs((s) => s.hydrate);
  useEffect(() => {
    hydratePrefs();
  }, [hydratePrefs]);

  // Each tab keeps its own sheet position; restore it when the tab (or the request) changes.
  const sheetRef = useRef<BottomSheet>(null);
  useEffect(() => {
    sheetRef.current?.snapToIndex(sheetIndex);
  }, [tab, sheetIndex]);

  const animationConfigs = useBottomSheetTimingConfigs({
    duration: 300,
    easing: Easing.bezier(0.2, 0.8, 0.2, 1),
  });

  const renderHandle = useCallback(
    () => (
      <SheetHandle
        expanded={sheetIndex === SHEET_FULL}
        // Tap: full → peek, peek → full, collapsed → peek.
        onToggle={() => setSheetIndex(tab, sheetIndex === SHEET_PEEK ? SHEET_FULL : SHEET_PEEK)}
      />
    ),
    [sheetIndex, setSheetIndex, tab],
  );

  const [satellite, setSatellite] = useState(false);
  // Traffic lines: Profile › Travel preferences (persisted).
  const traffic = useRoutlyPrefs((s) => s.prefs?.showTraffic ?? true);
  const [recenterKey, setRecenterKey] = useState(0);

  const selectTab = useCallback(
    (next: TabName) => {
      if (next !== tab) router.navigate(tabInfo[next].href);
    },
    [tab],
  );

  return (
    <GestureHandlerRootView
      style={styles.root}
      onLayout={(e) => {
        setHeight(e.nativeEvent.layout.height);
        setMeasured(true);
      }}
    >
      <LiveMap
        content={mapContent}
        userLocation={userLocation}
        // Fit routes above whatever the sheet covers (the full sheet hides the map).
        insets={{
          top: topBarBottom,
          bottom: sheetIndex === SHEET_COLLAPSED ? collapsedHeight : height - peekTop,
        }}
        satellite={satellite}
        traffic={traffic}
        recenterKey={recenterKey}
      />
      <MapOverlays
        top={topBarBottom}
        locationStatus={locationStatus}
        onEnableLocation={enableLocation}
        onRecenter={() => setRecenterKey((k) => k + 1)}
        onLayers={() => {
          setSatellite((s) => !s);
          showToast(satellite ? 'Map view' : 'Satellite view');
        }}
        satellite={satellite}
        traffic={traffic}
      />

      {measured && (
        <BottomSheet
          ref={sheetRef}
          index={sheetIndex}
          snapPoints={snapPoints}
          enableDynamicSizing={false}
          enablePanDownToClose={false}
          animationConfigs={animationConfigs}
          handleComponent={renderHandle}
          backgroundStyle={styles.sheetBackground}
          style={shadows.sheet}
          keyboardBehavior="extend"
          keyboardBlurBehavior="restore"
          android_keyboardInputMode="adjustResize"
          onChange={(index) => {
            if (isSheetIndex(index)) setSheetIndex(tab, index);
          }}
        >
          <View style={styles.sheetContent}>{children}</View>
        </BottomSheet>
      )}

      <TopBar config={topBar} />
      <FloatingNavBar active={tab} onSelect={selectTab} />
      <Toast />
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.map.land },
  sheetBackground: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
  },
  sheetContent: { flex: 1 },
});
