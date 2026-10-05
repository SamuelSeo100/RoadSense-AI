import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { Icon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { cn } from '@/lib/cn';
import { elevation } from '@/theme/tokens';

import { modeFilters } from '../homeMockData';

/** Multi-select transit mode toggles. Local UI state for now. */
export function ModeFilters() {
  const [enabled, setEnabled] = useState(() => new Set(modeFilters.map((m) => m.id)));

  const toggle = (id: string) =>
    setEnabled((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <View className="gap-space-xs">
      <View className="flex-row items-center justify-between">
        <Text variant="label-lg">Available Transit Modes</Text>
        <Text variant="label-sm" tone="secondary">
          {enabled.size} enabled
        </Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="-mx-margin"
        contentContainerClassName="gap-space-xs px-margin py-1"
      >
        {modeFilters.map((m) => {
          const on = enabled.has(m.id);
          return (
            <Pressable
              key={m.id}
              onPress={() => toggle(m.id)}
              hitSlop={{ top: 8, bottom: 8 }}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}
              accessibilityLabel={m.label}
              className={cn(
                'flex-row items-center gap-1 rounded-lg px-2.5 py-1.5',
                m.container,
                !on && 'opacity-50',
              )}
              style={{ boxShadow: elevation.card }}
            >
              <Icon name={m.icon} size={16} tone={m.iconTone} />
              <Text variant="label-sm" tone={m.textTone} weight={m.bold ? 'bold' : undefined}>
                {m.label}
              </Text>
              <Icon
                name={on ? 'check-circle-outline' : 'add-circle-outline'}
                size={14}
                tone={m.checkTone}
              />
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}
