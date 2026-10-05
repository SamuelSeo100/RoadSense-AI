import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { Icon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { cn } from '@/lib/cn';
import { elevation } from '@/theme/tokens';

import { priorities, type HomePriority } from '../homeMockData';
import { SectionHeader } from './SectionHeader';

function AiBadge() {
  return (
    <View className="flex-row items-center gap-1 rounded-full bg-secondary-container px-2 py-0.5">
      <Icon name="auto-awesome" size={12} tone="primary" />
      <Text variant="label-sm" tone="on-secondary-fixed">
        AI Powered
      </Text>
    </View>
  );
}

/** Horizontal single-select routing priority chips. Selection is local UI state for now. */
export function PrioritySelector() {
  const [selected, setSelected] = useState<HomePriority>('balanced');

  return (
    <View className="gap-space-xs">
      <SectionHeader title="Routing Priority" badge={<AiBadge />} />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="-mx-margin"
        contentContainerClassName="gap-space-xs px-margin py-1"
        accessibilityRole="radiogroup"
        accessibilityLabel="Routing priority"
      >
        {priorities.map((p) => {
          const active = p.value === selected;
          return (
            <Pressable
              key={p.value}
              onPress={() => setSelected(p.value)}
              hitSlop={{ top: 6, bottom: 6 }}
              accessibilityRole="radio"
              accessibilityState={{ checked: active }}
              accessibilityLabel={p.label}
              className={cn(
                'flex-row items-center gap-1.5 rounded-full px-3 py-2',
                active ? 'bg-primary' : 'bg-surface-container-lowest',
              )}
              style={{ boxShadow: elevation.card }}
            >
              <Icon name={p.icon} size={16} tone={active ? 'primary-fixed' : 'secondary'} />
              <Text variant="label-md" tone={active ? 'on-primary' : 'on-surface'}>
                {p.label}
              </Text>
              {p.badge ? (
                <View
                  className={cn(
                    'rounded-full px-1.5 py-0.5',
                    active ? 'bg-primary-fixed' : 'bg-surface-container',
                  )}
                >
                  <Text variant="label-sm" tone={active ? 'on-primary-fixed' : 'primary'}>
                    {p.badge}
                  </Text>
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}
