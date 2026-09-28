import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, View } from 'react-native';

import { AppHeader } from '@/components/brand/AppHeader';
import { GoogleIcon } from '@/components/brand/GoogleIcon';
import { Logo } from '@/components/brand/Logo';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Divider } from '@/components/ui/Divider';
import { Screen } from '@/components/ui/Screen';
import { SegmentedTabs } from '@/components/ui/SegmentedTabs';
import { Text } from '@/components/ui/Text';

import { authService } from '../auth.service';
import { CoverageBanner } from '../components/CoverageBanner';
import { EmailLoginForm } from '../components/EmailLoginForm';
import { PhoneLoginForm } from '../components/PhoneLoginForm';
import { useAsyncAction } from '../hooks/useAsyncAction';

type LoginMethod = 'phone' | 'email';

const METHOD_OPTIONS = [
  { value: 'phone', label: 'Phone' },
  { value: 'email', label: 'Email' },
] as const;

export function LoginScreen() {
  const router = useRouter();
  const [method, setMethod] = useState<LoginMethod>('phone');

  const sendOtp = useAsyncAction(authService.sendOtp);
  const emailLogin = useAsyncAction(authService.signInWithEmail);
  const googleLogin = useAsyncAction(authService.signInWithGoogle);

  const handleGoogle = async () => {
    const { error } = await googleLogin.run();
    // No field to attach Google errors to, so show them in an alert.
    if (error) Alert.alert('Google sign-in', error);
  };

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

          <SegmentedTabs
            options={METHOD_OPTIONS}
            value={method}
            onChange={setMethod}
            accessibilityLabel="Login method"
            className="mb-5"
          />

          {method === 'phone' ? (
            <PhoneLoginForm
              submitting={sendOtp.pending}
              error={sendOtp.error}
              onSubmit={async ({ phone }) => {
                if ((await sendOtp.run(phone)).ok) {
                  router.push({ pathname: '/verify-otp', params: { phone } });
                }
              }}
            />
          ) : (
            <EmailLoginForm
              submitting={emailLogin.pending}
              error={emailLogin.error}
              onSubmit={({ email, password }) => emailLogin.run(email, password)}
              onForgotPassword={() =>
                Alert.alert('Forgot password', 'Password reset arrives with auth wiring (Phase 4).')
              }
            />
          )}

          <Divider label="or continue with" className="my-6" />

          <Button
            variant="secondary"
            label="Continue with Google"
            labelWeight="medium"
            leading={<GoogleIcon />}
            loading={googleLogin.pending}
            onPress={handleGoogle}
          />

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
