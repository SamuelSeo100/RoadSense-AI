import { useRouter } from 'expo-router';
import { Alert, Pressable, View } from 'react-native';

import { LogoHeader } from '@/components/brand/LogoHeader';
import { Divider } from '@/components/ui/Divider';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { usePreferencesStore } from '@/store/preferencesStore';

import { authService } from '../auth.service';
import { GoogleSignInButton } from '../components/GoogleSignInButton';
import { SignupForm } from '../components/SignupForm';
import { useAsyncAction } from '../hooks/useAsyncAction';

export function SignupScreen() {
  const router = useRouter();
  const setPreferences = usePreferencesStore((s) => s.setPreferences);
  const signUp = useAsyncAction(authService.signUp);

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
          const res = await signUp.run(input);
          if (!res.ok) return;
          setPreferences({
            preferredModes: input.preferredModes,
            priority: input.priority,
            city: input.city,
          });
          // Without confirmation the session starts right away and the auth gate
          // moves us to home; otherwise ask the user to confirm their email.
          if (res.result.needsEmailConfirmation) {
            router.replace({ pathname: '/check-email', params: { email: input.email } });
          }
        }}
      />

      <Divider label="or sign up with" className="my-6" />
      <GoogleSignInButton />

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
