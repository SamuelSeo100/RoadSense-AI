import { Fragment } from 'react';
import { Pressable, View } from 'react-native';

import { Icon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { cn } from '@/lib/cn';
import { elevation } from '@/theme/tokens';

import { legStyles, recentTrips, type RecentTrip } from '../homeMockData';
import { SectionHeader } from './SectionHeader';

function Dot() {
  return (
    <Text variant="body-sm" tone="secondary">
      •
    </Text>
  );
}

function TripCard({ trip }: { trip: RecentTrip }) {
  return (
    <View
      className="gap-space-xs rounded-xl bg-surface-container-lowest p-space-md"
      style={{ boxShadow: elevation.card }}
    >
      <View className="flex-row items-start justify-between gap-space-sm">
        <View className="min-w-0 flex-1 gap-1">
          <View className="flex-row flex-wrap items-center gap-1.5">
            <Text variant="title-md">{trip.from}</Text>
            <Icon name="arrow-forward" size={16} tone="secondary" />
            <Text variant="title-md">{trip.to}</Text>
          </View>
          <View className="flex-row flex-wrap items-center gap-1.5">
            {trip.legs.map((leg, i) => {
              const s = legStyles[leg.kind];
              return (
                <Fragment key={leg.label}>
                  {i > 0 ? <Dot /> : null}
                  <View
                    className={cn('flex-row items-center gap-1 rounded px-2 py-0.5', s.container)}
                  >
                    <Icon name={s.icon} size={13} tone={s.tone} />
                    <Text variant="label-sm" tone={s.tone}>
                      {leg.label}
                    </Text>
                  </View>
                </Fragment>
              );
            })}
          </View>
        </View>
        <Pressable
          className="rounded-lg bg-primary/10 px-space-sm py-1.5 active:bg-primary/20"
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={`Repeat trip from ${trip.from} to ${trip.to}`}
        >
          <Text variant="label-md" tone="primary">
            Repeat
          </Text>
        </Pressable>
      </View>
      <View className="flex-row items-center justify-between pt-1">
        <View className="flex-row items-center gap-space-xs">
          <Text variant="headline-sm" tabular>
            {trip.duration}
          </Text>
          <Dot />
          <Text variant="title-md" tabular>
            {trip.fare}
          </Text>
          <Dot />
          <Text
            variant="body-sm"
            tone={trip.note.tone}
            weight={trip.note.tone === 'secondary' ? undefined : 'medium'}
          >
            {trip.note.text}
          </Text>
        </View>
        <View
          className={cn(
            'rounded-full px-2 py-0.5',
            trip.tag.highlight ? 'bg-primary/10' : 'bg-surface-container-high',
          )}
        >
          <Text variant="label-sm" tone={trip.tag.highlight ? 'primary' : 'secondary'}>
            {trip.tag.label}
          </Text>
        </View>
      </View>
    </View>
  );
}

export function RecentTrips() {
  return (
    <View className="gap-space-xs">
      <SectionHeader title="Recent Trips" actionLabel="History" />
      <View className="gap-space-sm">
        {recentTrips.map((t) => (
          <TripCard key={t.id} trip={t} />
        ))}
      </View>
    </View>
  );
}
