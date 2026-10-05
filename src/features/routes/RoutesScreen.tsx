import { TabHeader } from '@/components/brand/TabHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { Screen } from '@/components/ui/Screen';

/** Placeholder until route search results land. */
export function RoutesScreen() {
  return (
    <Screen header={<TabHeader title="Routes" />} scroll={false} insetBottom={false}>
      <EmptyState
        icon="alt-route"
        title="Routes"
        message="Compare multi-modal routes across Pune. Coming soon."
      />
    </Screen>
  );
}
