import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, View, type PressableProps } from 'react-native';

import { cn } from '@/lib/cn';
import { colors, elevation, type ColorToken, type fontFamilies } from '@/theme/tokens';

import { Icon, type IconName } from './Icon';
import { Text } from './Text';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost';

const variantStyles: Record<
  ButtonVariant,
  { container: string; tone: ColorToken; raised: boolean }
> = {
  // Primary CTA: teal fill, darkens on press (DESIGN.md › Components 5).
  primary: {
    container: 'bg-primary active:bg-on-primary-fixed-variant',
    tone: 'on-primary',
    raised: true,
  },
  // Tonal button (e.g. "Continue with Google" in login.html).
  secondary: {
    container: 'bg-surface-container-low active:bg-surface-container',
    tone: 'on-surface',
    raised: false,
  },
  outline: {
    container:
      'border border-outline-variant bg-surface-container-lowest active:bg-surface-container-low',
    tone: 'primary',
    raised: false,
  },
  ghost: {
    container: 'bg-transparent active:bg-surface-container-low',
    tone: 'primary',
    raised: false,
  },
};

export interface ButtonProps extends Omit<PressableProps, 'children' | 'style'> {
  label: string;
  variant?: ButtonVariant;
  /** Material icon after the label (e.g. `arrow-forward`). */
  iconRight?: IconName;
  /** Custom element before the label (e.g. the Google mark). */
  leading?: ReactNode;
  loading?: boolean;
  /** Stretch to the container width (default true). */
  fullWidth?: boolean;
  labelWeight?: keyof typeof fontFamilies;
  className?: string;
}

export function Button({
  label,
  variant = 'primary',
  iconRight,
  leading,
  loading = false,
  disabled = false,
  fullWidth = true,
  labelWeight,
  className,
  accessibilityLabel,
  ...rest
}: ButtonProps) {
  const v = variantStyles[variant];
  const inactive = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      className={cn(
        'h-12 flex-row items-center justify-center gap-space-sm rounded-control px-space-lg',
        fullWidth ? 'w-full' : 'self-start',
        v.container,
        disabled && !loading && 'opacity-40',
        className,
      )}
      style={v.raised && !disabled ? { boxShadow: elevation.card } : undefined}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={colors[v.tone]} />
      ) : (
        <>
          {leading ? <View className="mr-space-xs">{leading}</View> : null}
          <Text variant="label-lg" tone={v.tone} weight={labelWeight}>
            {label}
          </Text>
          {iconRight ? <Icon name={iconRight} size={18} tone={v.tone} /> : null}
        </>
      )}
    </Pressable>
  );
}
