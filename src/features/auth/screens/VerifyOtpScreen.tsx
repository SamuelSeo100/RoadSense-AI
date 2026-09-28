import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { AppHeader } from '@/components/brand/AppHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { OtpInput } from '@/components/ui/OtpInput';
import { formatIndianMobile } from '@/components/ui/PhoneInput';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';

import { authService } from '../auth.service';
import { useAsyncAction } from '../hooks/useAsyncAction';

const OTP_LENGTH = 6;

/** Preview of the OTP step. TODO(Phase 3): masked number, 30s resend timer. */
export function VerifyOtpScreen() {
  const router = useRouter();
  const { phone = '' } = useLocalSearchParams<{ phone?: string }>();
  const [code, setCode] = useState('');
  const verify = useAsyncAction(authService.verifyOtp);

  return (
    <Screen header={<AppHeader onBack={router.canGoBack() ? router.back : undefined} />}>
      <Card>
        <View className="mb-5">
          <Text variant="headline-lg" role="heading">
            Verify your number
          </Text>
          <Text variant="body-md" tone="on-surface-variant" className="mt-0.5">
            Enter the 6-digit code sent to{' '}
            <Text variant="body-md" weight="semibold" tabular>
              +91 {formatIndianMobile(phone)}
            </Text>
          </Text>
        </View>
        <OtpInput
          value={code}
          onChange={(next) => {
            setCode(next);
            verify.clearError();
          }}
          length={OTP_LENGTH}
          error={verify.error ?? undefined}
          autoFocus
        />
        <Button
          label="Verify & continue"
          className="mt-6"
          disabled={code.length !== OTP_LENGTH}
          loading={verify.pending}
          onPress={() => verify.run(phone, code)}
        />
      </Card>
    </Screen>
  );
}
