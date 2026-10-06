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
import { SheetHandle } from './SheetHandle';
import { SHEET_FULL, SHEET_PEEK, showToast, useShellStore } from './shellStore';
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
  const tab = tabFromPath(usePathname());

  const topBarBottom = insets.top + layout.topBarHeight;
  const peekTop = Math.round(height * layout.sheetPeekTopRatio);
  const snapPoints = useMemo(
    () => [height - peekTop, height - topBarBottom],
    [height, peekTop, topBarBottom],
  );

  const topBar = useShellStore((s) => s.topBar[tab]);
  const sheetIndex = useShellStore((s) => s.sheetIndex[tab]);
  const setSheetIndex = useShellStore((s) => s.setSheetIndex);
  const mapContent = useMapStore((s) => s.content[tab]);
  const userLocation = useMapStore((s) => s.userLocation);
  const area = useMapStore((s) => s.area);
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
        onToggle={() => setSheetIndex(tab, sheetIndex === SHEET_FULL ? SHEET_PEEK : SHEET_FULL)}
      />
    ),
    [sheetIndex, setSheetIndex, tab],
  );

  const [satellite, setSatellite] = useState(false);
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
      onLayout={(e) => setHeight(e.nativeEvent.layout.height)}
    >
      <LiveMap
        content={mapContent}
        userLocation={userLocation}
        area={area}
        insets={{ top: topBarBottom, bottom: height - peekTop }}
        satellite={satellite}
        recenterKey={recenterKey}
      />
      <MapOverlays
        top={topBarBottom}
        peekTop={peekTop}
        locationStatus={locationStatus}
        onEnableLocation={enableLocation}
        onRecenter={() => setRecenterKey((k) => k + 1)}
        onLayers={() => {
          setSatellite((s) => !s);
          showToast(satellite ? 'Map view' : 'Satellite view');
        }}
        satellite={satellite}
      />

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
          if (index === SHEET_PEEK || index === SHEET_FULL) setSheetIndex(tab, index);
        }}
      >
        <View style={styles.sheetContent}>{children}</View>
      </BottomSheet>

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
