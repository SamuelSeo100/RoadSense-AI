import { useRouter } from 'expo-router';
import { Alert, Pressable, View } from 'react-native';

import { GoogleIcon } from '@/components/brand/GoogleIcon';
import { LogoHeader } from '@/components/brand/LogoHeader';
import { Button } from '@/components/ui/Button';
import { Divider } from '@/components/ui/Divider';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { usePreferencesStore } from '@/store/preferencesStore';

import { authService } from '../auth.service';
import { SignupForm } from '../components/SignupForm';
import { useAsyncAction } from '../hooks/useAsyncAction';

export function SignupScreen() {
  const router = useRouter();
  const setPreferences = usePreferencesStore((s) => s.setPreferences);
  const signUp = useAsyncAction(authService.signUp);
  const googleLogin = useAsyncAction(authService.signInWithGoogle);

  const goToLogin = () => (router.canGoBack() ? router.back() : router.replace('/login'));

  return (
    <Screen
      background="surface-container-lowest"
      header={<LogoHeader onBack={router.canGoBack() ? router.back : undefined} />}
    >
      <View className="mb-space-xl">
        <Text variant="headline-lg" role="heading">
          Create your account
        </Text>
        <Text variant="body-md" tone="on-surface-variant" className="mt-0.5">
          Get personalised route recommendations
        </Text>
      </View>

      <SignupForm
        submitting={signUp.pending}
        error={signUp.error}
        onOpenTerms={() => Alert.alert('Terms of Service', 'Coming soon.')}
        onOpenPrivacy={() => Alert.alert('Privacy Policy', 'Coming soon.')}
        onSubmit={async ({ confirmPassword: _c, acceptTerms: _t, ...input }) => {
          const { ok } = await signUp.run(input);
          if (!ok) return;
          setPreferences({
            preferredModes: input.preferredModes,
            priority: input.priority,
            city: input.city,
          });
          router.push({ pathname: '/verify-otp', params: { phone: input.phone } });
        }}
      />

      <Divider label="or sign up with" className="my-6" />

      <Button
        variant="secondary"
        label="Continue with Google"
        labelWeight="medium"
        leading={<GoogleIcon />}
        loading={googleLogin.pending}
        onPress={async () => {
          const { error } = await googleLogin.run();
          if (error) Alert.alert('Google sign-up', error);
        }}
      />

      <View className="mt-6 flex-row items-center justify-center">
        <Text variant="body-md" tone="on-surface-variant">
          Already have an account?{' '}
        </Text>
        <Pressable
          onPress={goToLogin}
          className="py-3"
          hitSlop={{ left: 8, right: 8 }}
          accessibilityRole="link"
        >
          <Text variant="body-md" tone="primary" weight="semibold">
            Log in
          </Text>
        </Pressable>
      </View>
    </Screen>
  );
}
