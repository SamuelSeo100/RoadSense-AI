import { useId, useState, type Ref } from 'react';
import {
  TextInput as RNTextInput,
  View,
  type TextInputProps as RNTextInputProps,
} from 'react-native';

import { cn } from '@/lib/cn';
import { withAlpha } from '@/theme/color';
import { colors } from '@/theme/tokens';

import { Field, type FieldProps } from './Field';
import { Text } from './Text';
import { fieldSurfaceClassName, inputTextClassName, placeholderColor } from './TextInput';

export const PHONE_DIGITS = 10;

/** `9822012345` → `98220 12345` (Indian mobile grouping). */
export function formatIndianMobile(digits: string): string {
  return digits.length > 5 ? `${digits.slice(0, 5)} ${digits.slice(5)}` : digits;
}

export interface PhoneInputProps
  extends
    Omit<
      RNTextInputProps,
      'value' | 'onChangeText' | 'style' | 'keyboardType' | 'maxLength' | 'placeholderTextColor'
    >,
    Pick<FieldProps, 'label' | 'helper' | 'helperIcon' | 'error'> {
  /** Raw digits only, max 10, no country code. */
  value: string;
  onChangeText: (digits: string) => void;
  ref?: Ref<RNTextInput>;
}

/** Fixed 🇮🇳 +91 prefix and a 10-digit mobile field. Emits digits only. */
export function PhoneInput({
  label = 'Mobile Number',
  helper,
  helperIcon,
  error,
  value,
  onChangeText,
  onFocus,
  onBlur,
  placeholder = '98220 12345',
  ref,
  ...rest
}: PhoneInputProps) {
  const [focused, setFocused] = useState(false);
  const labelId = useId();

  return (
    <Field label={label} helper={helper} helperIcon={helperIcon} error={error} nativeID={labelId}>
      <View className="flex-row items-center gap-2">
        <View
          className="h-12 flex-row items-center gap-1.5 rounded-control bg-surface-container-low px-3"
          accessibilityLabel="Country code India, plus 91"
        >
          <Text variant="body-lg" importantForAccessibility="no">
            🇮🇳
          </Text>
          <Text variant="data-time" tabular importantForAccessibility="no">
            +91
          </Text>
        </View>
        <View className={cn('flex-1', fieldSurfaceClassName({ focused, error: Boolean(error) }))}>
          <RNTextInput
            ref={ref}
            value={formatIndianMobile(value)}
            onChangeText={(text) => onChangeText(text.replace(/\D/g, '').slice(0, PHONE_DIGITS))}
            keyboardType="phone-pad"
            inputMode="tel"
            textContentType="telephoneNumber"
            autoComplete="tel-national"
            // 10 digits + the display space.
            maxLength={PHONE_DIGITS + 1}
            placeholder={placeholder}
            placeholderTextColor={placeholderColor}
            cursorColor={colors.primary}
            selectionColor={withAlpha(colors.primary, 0.3)}
            textAlignVertical="center"
            className={cn(inputTextClassName, 'px-3.5 font-data-time text-data-time')}
            style={{ includeFontPadding: false, fontVariant: ['tabular-nums'] }}
            accessibilityLabel={label}
            accessibilityLabelledBy={labelId}
            accessibilityHint={error ?? helper}
            aria-invalid={Boolean(error)}
            onFocus={(e) => {
              setFocused(true);
              onFocus?.(e);
            }}
            onBlur={(e) => {
              setFocused(false);
              onBlur?.(e);
            }}
            {...rest}
          />
        </View>
      </View>
    </Field>
  );
}
