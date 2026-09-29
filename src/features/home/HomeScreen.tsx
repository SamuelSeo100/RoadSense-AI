import { useState } from 'react';
import { Alert, View } from 'react-native';

import { AppHeader } from '@/components/brand/AppHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { authService, isMockAuth } from '@/features/auth/auth.service';
import { useAuthStore } from '@/store/authStore';

/** Placeholder home until route search lands. Confirms the session works. */
export function HomeScreen() {
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

  const firstName = user?.name.split(' ')[0];

  return (
    <Screen header={<AppHeader />}>
      <Card>
        <Text variant="headline-lg" role="heading">
          {firstName ? `Hi, ${firstName}` : 'Welcome'}
        </Text>
        <Text variant="body-md" tone="on-surface-variant" className="mt-0.5">
          You’re signed in{user?.email ? ` as ${user.email}` : ''}.
        </Text>
        <View className="mt-5 rounded-control bg-surface-container-low p-space-md">
          <Text variant="body-sm" tone="on-surface-variant">
            Route search is coming next.{isMockAuth ? ' (Mock auth mode)' : ''}
          </Text>
        </View>
        <Button
          variant="outline"
          label="Sign out"
          iconRight="logout"
          className="mt-6"
          loading={signingOut}
          onPress={handleSignOut}
        />
      </Card>
    </Screen>
  );
}
