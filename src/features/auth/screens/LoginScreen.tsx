import { Link, useRouter } from 'expo-router';
import { Alert, View } from 'react-native';

import { AppHeader } from '@/components/brand/AppHeader';
import { Logo } from '@/components/brand/Logo';
import { Card } from '@/components/ui/Card';
import { Divider } from '@/components/ui/Divider';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';

import { authService } from '../auth.service';
import { CoverageBanner } from '../components/CoverageBanner';
import { EmailLoginForm } from '../components/EmailLoginForm';
import { GoogleSignInButton } from '../components/GoogleSignInButton';
import { useAsyncAction } from '../hooks/useAsyncAction';

/** Email + password or Google login. On success the root auth gate switches to the app. */
export function LoginScreen() {
  const router = useRouter();
  const emailLogin = useAsyncAction(authService.signInWithEmail);

  return (
    <Screen
      padded={false}
      header={<AppHeader onBack={router.canGoBack() ? router.back : undefined} />}
    >
      {/* Hero */}
      <View className="items-center bg-surface-container-lowest px-margin py-8">
        <Logo />
        <Text variant="body-sm" tone="on-surface-variant" weight="medium" className="mt-1.5">
          Smarter routes. Every mode.
        </Text>
      </View>

      <View className="px-margin">
        <Card>
          <View className="mb-5">
            <Text variant="headline-lg" role="heading">
              Welcome back
            </Text>
            <Text variant="body-md" tone="on-surface-variant" className="mt-0.5">
              Log in to plan your next trip
            </Text>
          </View>

          <EmailLoginForm
            submitting={emailLogin.pending}
            error={emailLogin.error}
            onSubmit={({ email, password }) => emailLogin.run(email, password)}
            onForgotPassword={() =>
              Alert.alert('Forgot password', 'Password reset is coming soon.')
            }
          />

          <Divider label="or continue with" className="my-6" />
          <GoogleSignInButton />

          <View className="mt-6 flex-row items-center justify-center">
            <Text variant="body-md" tone="on-surface-variant">
              New to RoadSense?{' '}
            </Text>
            <Link href="/signup" className="py-3" accessibilityRole="link">
              <Text variant="body-md" tone="primary" weight="semibold">
                Sign up
              </Text>
            </Link>
          </View>
        </Card>

        <View className="mt-4">
          <CoverageBanner />
        </View>
      </View>
    </Screen>
  );
}
