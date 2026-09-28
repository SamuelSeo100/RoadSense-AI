import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { PhoneInput } from '@/components/ui/PhoneInput';

import { phoneLoginSchema, type PhoneLoginValues } from '../schemas';

interface PhoneLoginFormProps {
  onSubmit: (values: PhoneLoginValues) => void;
  submitting?: boolean;
  /** Server-side error (e.g. OTP send failed). */
  error?: string | null;
}

export function PhoneLoginForm({ onSubmit, submitting = false, error }: PhoneLoginFormProps) {
  const { control, handleSubmit, formState } = useForm<PhoneLoginValues>({
    resolver: zodResolver(phoneLoginSchema),
    mode: 'onChange',
    defaultValues: { phone: '' },
  });

  return (
    <View className="gap-6">
      <Controller
        control={control}
        name="phone"
        render={({ field, fieldState }) => (
          <PhoneInput
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            ref={field.ref}
            error={
              error ??
              (fieldState.isTouched || formState.isSubmitted
                ? fieldState.error?.message
                : undefined)
            }
            helper="Instant OTP verification via SMS / WhatsApp"
            helperIcon="verified-user"
            returnKeyType="done"
            onSubmitEditing={handleSubmit(onSubmit)}
          />
        )}
      />
      <Button
        label="Send OTP"
        iconRight="arrow-forward"
        onPress={handleSubmit(onSubmit)}
        disabled={!formState.isValid}
        loading={submitting}
      />
    </View>
  );
}
