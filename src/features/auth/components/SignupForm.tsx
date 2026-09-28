import { zodResolver } from '@hookform/resolvers/zod';
import type { ReactNode } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { Keyboard, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { ChipGroup } from '@/components/ui/Chip';
import { PhoneInput } from '@/components/ui/PhoneInput';
import { Select } from '@/components/ui/Select';
import { Text } from '@/components/ui/Text';
import { TextInput } from '@/components/ui/TextInput';
import { CITIES, cityInfo, DEFAULT_CITY } from '@/constants/cities';
import { ROUTE_PRIORITIES, routePriorityInfo } from '@/constants/routePriorities';
import { TRANSIT_MODES, transitModeInfo } from '@/constants/transitModes';

import { signupSchema, type SignupFormInput, type SignupValues } from '../schemas';

import { PasswordStrengthMeter } from './PasswordStrengthMeter';

const MODE_OPTIONS = TRANSIT_MODES.map((m) => ({
  value: m,
  label: transitModeInfo[m].label,
  icon: transitModeInfo[m].icon,
}));

const PRIORITY_OPTIONS = ROUTE_PRIORITIES.map((p) => ({
  value: p,
  label: routePriorityInfo[p].label,
  icon: routePriorityInfo[p].icon,
}));

const CITY_OPTIONS = CITIES.map((c) => ({
  value: c,
  label: cityInfo[c].label,
  disabled: !cityInfo[c].supported,
  disabledHint: 'Coming soon',
}));

function Section({ title, hint, children }: { title: string; hint: string; children: ReactNode }) {
  return (
    <View className="gap-space-md">
      <View>
        <Text variant="title-md" role="heading">
          {title}
        </Text>
        <Text variant="body-sm" tone="on-surface-variant" className="mt-0.5">
          {hint}
        </Text>
      </View>
      {children}
    </View>
  );
}

interface SignupFormProps {
  onSubmit: (values: SignupValues) => void;
  onOpenTerms: () => void;
  onOpenPrivacy: () => void;
  submitting?: boolean;
  error?: string | null;
}

export function SignupForm({
  onSubmit,
  onOpenTerms,
  onOpenPrivacy,
  submitting = false,
  error,
}: SignupFormProps) {
  const { control, handleSubmit, formState, setFocus } = useForm<
    SignupFormInput,
    unknown,
    SignupValues
  >({
    resolver: zodResolver(signupSchema),
    mode: 'onChange',
    defaultValues: {
      name: '',
      phone: '',
      email: '',
      password: '',
      confirmPassword: '',
      preferredModes: [],
      priority: undefined,
      city: DEFAULT_CITY,
      acceptTerms: false,
    },
  });
  const password = useWatch({ control, name: 'password' });

  /** Inline errors appear once a field has been left (or after a submit attempt). */
  const visibleError = (touched: boolean, message?: string) =>
    touched || formState.isSubmitted ? message : undefined;

  return (
    <View className="gap-space-xl">
      {/* Account details */}
      <View className="gap-4">
        <Controller
          control={control}
          name="name"
          render={({ field, fieldState }) => (
            <TextInput
              label="Full name"
              leftIcon="person"
              placeholder="Aditi Kulkarni"
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              ref={field.ref}
              error={visibleError(fieldState.isTouched, fieldState.error?.message)}
              autoCapitalize="words"
              autoComplete="name"
              textContentType="name"
              returnKeyType="next"
              submitBehavior="submit"
              onSubmitEditing={() => setFocus('phone')}
            />
          )}
        />
        <Controller
          control={control}
          name="phone"
          render={({ field, fieldState }) => (
            <PhoneInput
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              ref={field.ref}
              error={visibleError(fieldState.isTouched, fieldState.error?.message)}
              helper="We’ll send an OTP to verify this number"
              returnKeyType="next"
              submitBehavior="submit"
              onSubmitEditing={() => setFocus('email')}
            />
          )}
        />
        <Controller
          control={control}
          name="email"
          render={({ field, fieldState }) => (
            <TextInput
              label="Email"
              optional
              leftIcon="mail"
              placeholder="name@example.com"
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              ref={field.ref}
              error={visibleError(fieldState.isTouched, fieldState.error?.message)}
              keyboardType="email-address"
              inputMode="email"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              textContentType="emailAddress"
              returnKeyType="next"
              submitBehavior="submit"
              onSubmitEditing={() => setFocus('password')}
            />
          )}
        />
        <View className="gap-space-sm">
          <Controller
            control={control}
            name="password"
            render={({ field, fieldState }) => (
              <TextInput
                label="Password"
                leftIcon="lock"
                password
                placeholder="At least 8 characters"
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                ref={field.ref}
                error={visibleError(fieldState.isTouched, fieldState.error?.message)}
                autoCapitalize="none"
                autoComplete="new-password"
                textContentType="newPassword"
                returnKeyType="next"
                submitBehavior="submit"
                onSubmitEditing={() => setFocus('confirmPassword')}
              />
            )}
          />
          <PasswordStrengthMeter password={password} />
        </View>
        <Controller
          control={control}
          name="confirmPassword"
          render={({ field, fieldState }) => (
            <TextInput
              label="Confirm password"
              leftIcon="lock"
              password
              placeholder="Re-enter password"
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              ref={field.ref}
              error={visibleError(fieldState.isTouched, fieldState.error?.message)}
              autoCapitalize="none"
              autoComplete="new-password"
              textContentType="newPassword"
              returnKeyType="done"
              onSubmitEditing={Keyboard.dismiss}
            />
          )}
        />
      </View>

      {/* Travel preferences (feed the ML route ranker) */}
      <Section title="How do you usually travel?" hint="Select all that apply">
        <Controller
          control={control}
          name="preferredModes"
          render={({ field }) => (
            <ChipGroup
              multiple
              options={MODE_OPTIONS}
              value={field.value}
              onChange={field.onChange}
              accessibilityLabel="How do you usually travel?"
            />
          )}
        />
      </Section>

      <Section title="What matters most to you?" hint="We’ll rank your route options by this">
        <Controller
          control={control}
          name="priority"
          render={({ field }) => (
            <ChipGroup
              options={PRIORITY_OPTIONS}
              value={field.value ?? null}
              onChange={field.onChange}
              accessibilityLabel="What matters most to you?"
            />
          )}
        />
      </Section>

      <Controller
        control={control}
        name="city"
        render={({ field }) => (
          <Select
            label="Home city"
            leftIcon="location-city"
            options={CITY_OPTIONS}
            value={field.value}
            onChange={field.onChange}
            sheetTitle="Choose your home city"
          />
        )}
      />

      <View className="gap-space-md">
        <Controller
          control={control}
          name="acceptTerms"
          render={({ field }) => (
            <Checkbox
              checked={field.value}
              onChange={field.onChange}
              accessibilityLabel="I agree to the Terms and Privacy Policy"
              label={
                <Text variant="body-md" tone="on-surface-variant">
                  I agree to the{' '}
                  <Text variant="body-md" tone="primary" weight="semibold" onPress={onOpenTerms}>
                    Terms
                  </Text>{' '}
                  &{' '}
                  <Text variant="body-md" tone="primary" weight="semibold" onPress={onOpenPrivacy}>
                    Privacy Policy
                  </Text>
                </Text>
              }
            />
          )}
        />
        <Button
          label="Create account"
          onPress={handleSubmit(onSubmit)}
          disabled={!formState.isValid}
          loading={submitting}
        />
        {error ? (
          <Text variant="body-sm" tone="error" className="text-center" accessibilityRole="alert">
            {error}
          </Text>
        ) : null}
      </View>
    </View>
  );
}
