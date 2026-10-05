import { TabHeader } from '@/components/brand/TabHeader';
import { Screen } from '@/components/ui/Screen';
import { useAuthStore } from '@/store/authStore';

import { GreetingCard } from './components/GreetingCard';
import { LivePulse } from './components/LivePulse';
import { ModeFilters } from './components/ModeFilters';
import { PrioritySelector } from './components/PrioritySelector';
import { RecentTrips } from './components/RecentTrips';
import { SavedPlaces } from './components/SavedPlaces';
import { TripSearchCard } from './components/TripSearchCard';
import { currentLocation } from './homeMockData';

/** Home tab (design/home.png). UI only: content is static until route search lands. */
export function HomeScreen() {
  const name = useAuthStore((s) => s.user?.name ?? '');

  return (
    <Screen header={<TabHeader title="Home" />} insetBottom={false} contentClassName="gap-space-lg">
      <GreetingCard name={name} area={currentLocation.area} />
      <TripSearchCard origin={currentLocation.label} />
      <PrioritySelector />
      <ModeFilters />
      <SavedPlaces />
      <RecentTrips />
      <LivePulse />
    </Screen>
  );
}
