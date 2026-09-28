import { zodResolver } from '@hookform/resolvers/zod';
import { useRef } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Pressable, TextInput as RNTextInput, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { TextInput } from '@/components/ui/TextInput';

import { emailLoginSchema, type EmailLoginValues } from '../schemas';

interface EmailLoginFormProps {
  onSubmit: (values: EmailLoginValues) => void;
  onForgotPassword: () => void;
  submitting?: boolean;
  error?: string | null;
}

export function EmailLoginForm({
  onSubmit,
  onForgotPassword,
  submitting = false,
  error,
}: EmailLoginFormProps) {
  const passwordRef = useRef<RNTextInput>(null);
  const { control, handleSubmit, formState } = useForm<EmailLoginValues>({
    resolver: zodResolver(emailLoginSchema),
    mode: 'onChange',
    defaultValues: { email: '', password: '' },
  });

  const showError = (touched: boolean) => touched || formState.isSubmitted;

  return (
    <View className="gap-4">
      <Controller
        control={control}
        name="email"
        render={({ field, fieldState }) => (
          <TextInput
            label="Email Address"
            leftIcon="mail"
            placeholder="name@example.com"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            ref={field.ref}
            error={showError(fieldState.isTouched) ? fieldState.error?.message : undefined}
            keyboardType="email-address"
            inputMode="email"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            textContentType="emailAddress"
            returnKeyType="next"
            onSubmitEditing={() => passwordRef.current?.focus()}
            submitBehavior="submit"
          />
        )}
      />
      <View className="gap-1.5">
        <Controller
          control={control}
          name="password"
          render={({ field, fieldState }) => (
            <TextInput
              label="Password"
              leftIcon="lock"
              password
              placeholder="••••••••"
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              ref={passwordRef}
              error={
                error ?? (showError(fieldState.isTouched) ? fieldState.error?.message : undefined)
              }
              autoCapitalize="none"
              autoComplete="current-password"
              textContentType="password"
              returnKeyType="go"
              onSubmitEditing={handleSubmit(onSubmit)}
            />
          )}
        />
        <Pressable
          onPress={onForgotPassword}
          className="self-end py-1"
          hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
          accessibilityRole="link"
        >
          <Text variant="label-md" tone="primary">
            Forgot password?
          </Text>
        </Pressable>
      </View>
      <Button
        label="Log in"
        iconRight="login"
        onPress={handleSubmit(onSubmit)}
        disabled={!formState.isValid}
        loading={submitting}
        className="mt-2"
      />
    </View>
  );
}
