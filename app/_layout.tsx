import '../global.css';
// Initialises Sentry before anything else renders.
import { navigationIntegration, Sentry, setSentryUser } from '@/lib/sentry';

import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from '@expo-google-fonts/inter';
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans';
import { Stack, useNavigationContainerRef } from 'expo-router';
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

function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    // Signed-in screens (src/theme/routly.ts).
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });
  useAuthListener();
  const authStatus = useAuthStore((s) => s.status);
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const navigationRef = useNavigationContainerRef();

  useEffect(() => {
    if (navigationRef) navigationIntegration.registerNavigationContainer(navigationRef);
  }, [navigationRef]);

  // Hashed id only (src/lib/sentry.ts).
  useEffect(() => {
    void setSentryUser(userId);
  }, [userId]);

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

export default Sentry.wrap(RootLayout);
