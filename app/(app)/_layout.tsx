import { Stack } from 'expo-router';

import { colors } from '@/theme/tokens';

// TODO(Phase 5): bottom tabs (Home, Routes, Profile).
export default function AppLayout() {
  return (
    <Stack
      screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.surface } }}
    />
  );
}
