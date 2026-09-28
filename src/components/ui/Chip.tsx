import { Pressable, View } from 'react-native';

import { cn } from '@/lib/cn';

import { Icon, type IconName } from './Icon';
import { Text } from './Text';

/** Chips are 40dp tall; hitSlop brings the touch area to 48dp. */
const CHIP_HIT_SLOP = { top: 4, bottom: 4 };

export interface ChipProps {
  label: string;
  selected?: boolean;
  icon?: IconName;
  onPress?: () => void;
  disabled?: boolean;
  /** `radio` for single-select groups, `checkbox` for multi-select. */
  role?: 'radio' | 'checkbox';
}

export function Chip({
  label,
  selected = false,
  icon,
  onPress,
  disabled = false,
  role = 'checkbox',
}: ChipProps) {
  const tone = selected ? 'on-primary' : 'on-surface-variant';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={CHIP_HIT_SLOP}
      accessibilityRole={role}
      accessibilityState={{ checked: selected, disabled }}
      accessibilityLabel={label}
      className={cn(
        'h-10 flex-row items-center gap-1.5 rounded-pill border px-space-md',
        selected
          ? 'border-primary bg-primary active:bg-on-primary-fixed-variant'
          : 'border-transparent bg-surface-container-low active:bg-surface-container',
        disabled && 'opacity-40',
      )}
    >
      {icon ? <Icon name={icon} size={18} tone={tone} /> : null}
      <Text variant="label-lg" tone={tone}>
        {label}
      </Text>
    </Pressable>
  );
}

export interface ChipOption<T extends string> {
  value: T;
  label: string;
  icon?: IconName;
}

type ChipGroupProps<T extends string> = {
  options: readonly ChipOption<T>[];
  accessibilityLabel: string;
} & (
  | { multiple: true; value: readonly T[]; onChange: (value: T[]) => void }
  | { multiple?: false; value: T | null; onChange: (value: T) => void }
);

/** Wrapping row of chips, single- or multi-select. */
export function ChipGroup<T extends string>(props: ChipGroupProps<T>) {
  const { options, accessibilityLabel } = props;

  const isSelected = (v: T) => (props.multiple ? props.value.includes(v) : props.value === v);

  const toggle = (v: T) => {
    if (props.multiple) {
      props.onChange(
        props.value.includes(v) ? props.value.filter((x) => x !== v) : [...props.value, v],
      );
    } else {
      props.onChange(v);
    }
  };

  return (
    <View
      className="flex-row flex-wrap gap-space-sm"
      accessibilityRole={props.multiple ? undefined : 'radiogroup'}
      accessibilityLabel={accessibilityLabel}
    >
      {options.map((o) => (
        <Chip
          key={o.value}
          label={o.label}
          icon={o.icon}
          selected={isSelected(o.value)}
          onPress={() => toggle(o.value)}
          role={props.multiple ? 'checkbox' : 'radio'}
        />
      ))}
    </View>
  );
}
