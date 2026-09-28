import { useId, useState } from 'react';
import { Modal, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { cn } from '@/lib/cn';
import { elevation, spacing } from '@/theme/tokens';

import { Field, type FieldProps } from './Field';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';
import { fieldSurfaceClassName } from './TextInput';

export interface SelectOption<T extends string> {
  value: T;
  label: string;
  /** Shown greyed out with `disabledHint`. */
  disabled?: boolean;
  disabledHint?: string;
}

interface SelectProps<T extends string> extends Pick<FieldProps, 'label' | 'helper' | 'error'> {
  options: readonly SelectOption<T>[];
  value: T;
  onChange: (value: T) => void;
  leftIcon?: IconName;
  /** Title of the bottom sheet (defaults to the label). */
  sheetTitle?: string;
}

/** Dropdown field that opens a bottom sheet of options (DESIGN.md › bottom sheets). */
export function Select<T extends string>({
  label,
  helper,
  error,
  options,
  value,
  onChange,
  leftIcon,
  sheetTitle,
}: SelectProps<T>) {
  const [open, setOpen] = useState(false);
  const insets = useSafeAreaInsets();
  const labelId = useId();
  const selected = options.find((o) => o.value === value);

  return (
    <Field label={label} helper={helper} error={error} nativeID={labelId}>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`${label ?? 'Select'}: ${selected?.label ?? 'none'}`}
        accessibilityHint="Opens a list of options"
        className={cn(fieldSurfaceClassName({ focused: open, error: Boolean(error) }), 'px-3.5')}
      >
        {leftIcon ? (
          <View className="mr-2">
            <Icon name={leftIcon} size={20} tone="outline" />
          </View>
        ) : null}
        <Text variant="body-md" className="flex-1">
          {selected?.label ?? ''}
        </Text>
        <Icon name="expand-more" size={24} tone="on-surface-variant" />
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="slide"
        statusBarTranslucent
        navigationBarTranslucent
        onRequestClose={() => setOpen(false)}
      >
        <View className="flex-1 justify-end">
          <Pressable
            className="absolute inset-0 bg-inverse-surface/40"
            onPress={() => setOpen(false)}
            accessibilityLabel="Close"
          />
          <View
            className="rounded-t-sheet bg-surface-container-lowest px-margin pt-space-sm"
            style={{
              boxShadow: elevation.sheet,
              paddingBottom: insets.bottom + spacing['space-lg'],
            }}
          >
            <View className="mb-space-md h-1 w-8 self-center rounded-full bg-outline-variant" />
            <Text variant="headline-sm" className="mb-space-sm" role="heading">
              {sheetTitle ?? label}
            </Text>
            <View accessibilityRole="radiogroup">
              {options.map((o) => {
                const isSelected = o.value === value;
                return (
                  <Pressable
                    key={o.value}
                    disabled={o.disabled}
                    onPress={() => {
                      onChange(o.value);
                      setOpen(false);
                    }}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: isSelected, disabled: o.disabled }}
                    className={cn(
                      'min-h-touch flex-row items-center gap-space-md rounded-control px-space-sm active:bg-surface-container-low',
                      o.disabled && 'opacity-40',
                    )}
                  >
                    <Icon
                      name={isSelected ? 'radio-button-checked' : 'radio-button-unchecked'}
                      size={22}
                      tone={isSelected ? 'primary' : 'outline'}
                    />
                    <Text variant="body-lg" className="flex-1">
                      {o.label}
                    </Text>
                    {o.disabled && o.disabledHint ? (
                      <Text variant="label-sm" tone="on-surface-variant" caps>
                        {o.disabledHint}
                      </Text>
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>
      </Modal>
    </Field>
  );
}
