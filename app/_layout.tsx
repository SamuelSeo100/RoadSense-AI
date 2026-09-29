import '../global.css';

import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from '@expo-google-fonts/inter';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import * as WebBrowser from 'expo-web-browser';
import { useEffect } from 'react';

import { useAuthListener } from '@/features/auth/hooks/useAuthListener';
import { useAuthStore } from '@/store/authStore';
import { colors } from '@/theme/tokens';

SplashScreen.preventAutoHideAsync();

// Web: when this page is the Google OAuth pop-up returning to the app, hand the
// redirect URL back to the opener window and close. No-op on native.
WebBrowser.maybeCompleteAuthSession();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });
  useAuthListener();
  const authStatus = useAuthStore((s) => s.status);

  const ready = (fontsLoaded || fontError !== null) && authStatus !== 'loading';

  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  const signedIn = authStatus === 'signedIn';

  return (
    <>
      <StatusBar style="dark" />
      {/* Auth gate: each group is only reachable in the matching session state. */}
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.surface },
        }}
      >
        <Stack.Protected guard={signedIn}>
          <Stack.Screen name="(app)" />
        </Stack.Protected>
        <Stack.Protected guard={!signedIn}>
          <Stack.Screen name="(auth)" />
        </Stack.Protected>
      </Stack>
    </>
  );
}
