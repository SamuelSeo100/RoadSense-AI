import { useRef, useState } from 'react';
import { Pressable, TextInput as RNTextInput, View } from 'react-native';

import { cn } from '@/lib/cn';

import { Field } from './Field';
import { Text } from './Text';
import { fieldSurfaceClassName } from './TextInput';

interface OtpInputProps {
  /** Digits entered so far, e.g. `"1234"`. */
  value: string;
  onChange: (value: string) => void;
  /** Called once all boxes are filled. */
  onComplete?: (code: string) => void;
  length?: number;
  error?: string;
  autoFocus?: boolean;
  label?: string;
}

/**
 * Six display boxes driven by ONE invisible TextInput laid over them. Native
 * text editing then gives us backspace, paste and SMS autofill for free on
 * every keyboard (per-box inputs rely on key events Android doesn't reliably send).
 */
export function OtpInput({
  value,
  onChange,
  onComplete,
  length = 6,
  error,
  autoFocus = false,
  label = 'One-time password',
}: OtpInputProps) {
  const inputRef = useRef<RNTextInput>(null);
  const [focused, setFocused] = useState(false);
  // The box the next digit goes into (stays on the last box when full).
  const activeIndex = Math.min(value.length, length - 1);

  const handleChangeText = (text: string) => {
    const next = text.replace(/\D/g, '').slice(0, length);
    onChange(next);
    if (next.length === length) onComplete?.(next);
  };

  return (
    <Field label={label} error={error}>
      <Pressable
        onPress={() => inputRef.current?.focus()}
        accessible={false}
        className="relative flex-row gap-2"
      >
        {Array.from({ length }, (_, i) => (
          <View
            key={i}
            className={cn(
              'h-14 flex-1 justify-center',
              fieldSurfaceClassName({
                focused: focused && i === activeIndex,
                error: Boolean(error),
              }),
            )}
            importantForAccessibility="no-hide-descendants"
          >
            {value[i] !== undefined ? (
              <Text variant="headline-md" tabular className="text-center">
                {value[i]}
              </Text>
            ) : focused && i === activeIndex ? (
              // Stand-in caret (the real input's caret is hidden).
              <View className="h-6 w-0.5 self-center bg-primary" />
            ) : null}
          </View>
        ))}
        <RNTextInput
          ref={inputRef}
          value={value}
          onChangeText={handleChangeText}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          maxLength={length}
          autoFocus={autoFocus}
          keyboardType="number-pad"
          inputMode="numeric"
          textContentType="oneTimeCode"
          autoComplete="sms-otp"
          caretHidden
          contextMenuHidden={false}
          // Invisible but still focusable and long-pressable (for paste).
          className="absolute inset-0 text-transparent opacity-0"
          accessibilityLabel={`${label}, ${length} digits`}
          accessibilityValue={{ text: value.split('').join(' ') }}
          aria-invalid={Boolean(error)}
        />
      </Pressable>
    </Field>
  );
}
