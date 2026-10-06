import { Tabs } from 'expo-router';

import { MapShell } from '@/features/shell/MapShell';
import { TABS } from '@/features/shell/tabs';
import { colors } from '@/theme/routly';

/**
 * Signed-in shell. The map, top bar, sheet and floating nav bar live in
 * MapShell; the tab navigator only swaps the sheet's content, so the map
 * instance persists across tabs.
 */
export default function AppLayout() {
  return (
    <MapShell>
      <Tabs
        // The floating pill nav is drawn by MapShell, outside the sheet.
        tabBar={() => null}
        screenOptions={{
          headerShown: false,
          animation: 'none',
          sceneStyle: { backgroundColor: colors.background },
        }}
      >
        {TABS.map((tab) => (
          <Tabs.Screen key={tab} name={tab} />
        ))}
      </Tabs>
    </MapShell>
  );
}
