import { useLocalSearchParams, useRouter } from 'expo-router';
import { View } from 'react-native';

import { LogoHeader } from '@/components/brand/LogoHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';

/** Shown after sign-up when the account needs email confirmation before first login. */
export function CheckEmailScreen() {
  const router = useRouter();
  const { email = '' } = useLocalSearchParams<{ email?: string }>();

  return (
    <Screen header={<LogoHeader />}>
      <Card className="items-center">
        <View className="mb-space-lg h-16 w-16 items-center justify-center rounded-full bg-primary-fixed">
          <Icon name="mark-email-unread" size={32} tone="on-primary-fixed-variant" />
        </View>
        <Text variant="headline-lg" role="heading" className="text-center">
          Check your email
        </Text>
        <Text variant="body-md" tone="on-surface-variant" className="mt-space-sm text-center">
          We sent a confirmation link to{' '}
          <Text variant="body-md" weight="semibold">
            {email || 'your email'}
          </Text>
          . Tap the link, then come back and log in.
        </Text>
        <Button
          label="Go to log in"
          iconRight="login"
          className="mt-6"
          onPress={() => router.replace('/login')}
        />
        <Text variant="body-sm" tone="on-surface-variant" className="mt-space-lg text-center">
          Didn’t get it? Check your spam folder.
        </Text>
      </Card>
    </Screen>
  );
}
