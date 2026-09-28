import { Text as RNText, type TextProps as RNTextProps } from 'react-native';

import { cn } from '@/lib/cn';
import {
  colors,
  fontFamilies,
  typography,
  type ColorToken,
  type TypographyToken,
} from '@/theme/tokens';

/** Tailwind `tracking-wider` (0.05em), used by Stitch on uppercase labels. */
const CAPS_TRACKING_EM = 0.05;

/** Literal class strings so Tailwind can find and compile them. */
const variantClassNames: Record<TypographyToken, string> = {
  'display-lg': 'font-display-lg text-display-lg',
  'headline-lg': 'font-headline-lg text-headline-lg',
  'headline-md': 'font-headline-md text-headline-md',
  'headline-sm': 'font-headline-sm text-headline-sm',
  'title-md': 'font-title-md text-title-md',
  'body-lg': 'font-body-lg text-body-lg',
  'body-md': 'font-body-md text-body-md',
  'body-sm': 'font-body-sm text-body-sm',
  'label-lg': 'font-label-lg text-label-lg',
  'label-md': 'font-label-md text-label-md',
  'label-sm': 'font-label-sm text-label-sm',
  'data-metric': 'font-data-metric text-data-metric',
  'data-time': 'font-data-time text-data-time',
};

export interface TextProps extends RNTextProps {
  /** DESIGN.md type style. Defaults to `body-md`. */
  variant?: TypographyToken;
  /** Color token. Defaults to `on-surface`. */
  tone?: ColorToken;
  /** Override the variant's weight. */
  weight?: keyof typeof fontFamilies;
  /** Tabular figures, for times, ₹ amounts, route codes. */
  tabular?: boolean;
  /** Uppercase with wide tracking (signage-style labels, badges, dividers). */
  caps?: boolean;
  /** Layout-only classes (margins, alignment, uppercase…). Use `tone`/`weight` for color and weight. */
  className?: string;
}

/**
 * App text. Always use this instead of React Native's `Text`, which would fall
 * back to the system font. `tone`, `weight` and `tabular` go through `style`, so
 * they reliably override the variant.
 */
export function Text({
  variant = 'body-md',
  tone = 'on-surface',
  weight,
  tabular = false,
  caps = false,
  className,
  style,
  ...rest
}: TextProps) {
  return (
    <RNText
      className={cn(variantClassNames[variant], className)}
      // Keys are only added when set: an explicit `undefined` would wipe the
      // font family coming from the variant class.
      style={[
        { color: colors[tone] },
        weight && { fontFamily: fontFamilies[weight] },
        tabular && { fontVariant: ['tabular-nums'] },
        caps && {
          textTransform: 'uppercase',
          letterSpacing: typography[variant].fontSize * CAPS_TRACKING_EM,
        },
        style,
      ]}
      {...rest}
    />
  );
}
