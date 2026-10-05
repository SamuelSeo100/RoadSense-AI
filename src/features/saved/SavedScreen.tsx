import { TabHeader } from '@/components/brand/TabHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { Screen } from '@/components/ui/Screen';

/** Placeholder until saved places and trips land. */
export function SavedScreen() {
  return (
    <Screen header={<TabHeader title="Saved" />} scroll={false} insetBottom={false}>
      <EmptyState
        icon="bookmark-border"
        title="Saved"
        message="Your saved places and trips will show up here. Coming soon."
      />
    </Screen>
  );
}
