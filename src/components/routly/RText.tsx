import { Text, type TextProps, type TextStyle } from 'react-native';

import { type as typeScale } from '@/theme/routly';

export type TypeVariant = keyof typeof typeScale;

interface RTextProps extends TextProps {
  /** Type style from the Routly theme. Defaults to `body`. */
  variant?: TypeVariant;
  color?: string;
  /** Font size override (keeps the variant's family). */
  size?: number;
  family?: TextStyle['fontFamily'];
}

/** Text in Plus Jakarta Sans with the Routly type scale. */
export function RText({ variant = 'body', color, size, family, style, ...rest }: RTextProps) {
  return (
    <Text
      style={[
        typeScale[variant],
        color !== undefined && { color },
        size !== undefined && { fontSize: size },
        family !== undefined && { fontFamily: family },
        style,
      ]}
      {...rest}
    />
  );
}
