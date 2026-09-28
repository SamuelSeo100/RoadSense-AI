import { useId, useState, type Ref } from 'react';
import {
  Pressable,
  TextInput as RNTextInput,
  View,
  type TextInputProps as RNTextInputProps,
} from 'react-native';

import { cn } from '@/lib/cn';
import { withAlpha } from '@/theme/color';
import { colors } from '@/theme/tokens';

import { Field, type FieldProps } from './Field';
import { Icon, type IconName } from './Icon';

export const placeholderColor = withAlpha(colors.outline, 0.6);

/** Field surface shared with PhoneInput: tonal fill, teal ring on focus, red ring on error. */
export function fieldSurfaceClassName(state: { focused: boolean; error: boolean }) {
  return cn(
    'h-12 flex-row items-center rounded-control border-2',
    state.error
      ? 'border-error bg-surface-container-lowest'
      : state.focused
        ? 'border-primary bg-surface-container-lowest'
        : 'border-transparent bg-surface-container-low',
  );
}

/** Input text classes; `py-0` + no font padding keeps Inter centered on Android. */
export const inputTextClassName = 'h-full flex-1 py-0 text-on-surface';

export interface TextInputProps
  extends
    Omit<RNTextInputProps, 'style' | 'placeholderTextColor'>,
    Pick<FieldProps, 'label' | 'helper' | 'helperIcon' | 'error' | 'optional'> {
  leftIcon?: IconName;
  /** Adds an eye toggle and hides the value. */
  password?: boolean;
  /** Use tabular `data-time` type (numbers) instead of `body-md`. */
  numeric?: boolean;
  ref?: Ref<RNTextInput>;
}

export function TextInput({
  label,
  helper,
  helperIcon,
  error,
  optional,
  leftIcon,
  password = false,
  numeric = false,
  editable = true,
  onFocus,
  onBlur,
  ref,
  ...rest
}: TextInputProps) {
  const [focused, setFocused] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const labelId = useId();

  return (
    <Field
      label={label}
      helper={helper}
      helperIcon={helperIcon}
      error={error}
      optional={optional}
      nativeID={labelId}
    >
      <View
        className={cn(
          fieldSurfaceClassName({ focused, error: Boolean(error) }),
          !editable && 'opacity-40',
        )}
      >
        {leftIcon ? (
          <View className="pl-3">
            <Icon name={leftIcon} size={20} tone="outline" />
          </View>
        ) : null}
        <RNTextInput
          ref={ref}
          className={cn(
            inputTextClassName,
            numeric ? 'font-data-time text-data-time' : 'font-body-md text-body-md',
            leftIcon ? 'pl-2' : 'pl-3.5',
            password ? 'pr-1' : 'pr-3.5',
          )}
          style={[{ includeFontPadding: false }, numeric && { fontVariant: ['tabular-nums'] }]}
          placeholderTextColor={placeholderColor}
          cursorColor={colors.primary}
          selectionColor={withAlpha(colors.primary, 0.3)}
          textAlignVertical="center"
          secureTextEntry={password && !revealed}
          editable={editable}
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
        {password ? (
          <Pressable
            onPress={() => setRevealed((r) => !r)}
            className="h-full w-12 items-center justify-center rounded-control active:bg-surface-container"
            accessibilityRole="button"
            accessibilityLabel={revealed ? 'Hide password' : 'Show password'}
          >
            <Icon name={revealed ? 'visibility' : 'visibility-off'} size={20} tone="outline" />
          </Pressable>
        ) : null}
      </View>
    </Field>
  );
}
