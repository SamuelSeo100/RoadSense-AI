import { useState } from 'react';
import { Alert, View } from 'react-native';

import { TabHeader } from '@/components/brand/TabHeader';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Screen } from '@/components/ui/Screen';
import { authService } from '@/features/auth/auth.service';
import { useAuthStore } from '@/store/authStore';

/** Placeholder profile: who's signed in, plus sign out. */
export function ProfileScreen() {
  const user = useAuthStore((s) => s.user);
  const [signingOut, setSigningOut] = useState(false);

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      // The auth gate sends us back to login once the session clears.
      await authService.signOut();
    } catch (e) {
      Alert.alert('Sign out failed', e instanceof Error ? e.message : 'Please try again.');
      setSigningOut(false);
    }
  };

  return (
    <Screen
      header={<TabHeader title="Profile" showAvatar={false} />}
      scroll={false}
      insetBottom={false}
    >
      <EmptyState
        icon="person"
        title={user?.name || 'Your profile'}
        message={user?.email ?? 'Profile settings are coming soon.'}
      >
        <View className="mt-space-xl w-full">
          <Button
            variant="outline"
            label="Sign out"
            iconRight="logout"
            loading={signingOut}
            onPress={handleSignOut}
          />
        </View>
      </EmptyState>
    </Screen>
  );
}
