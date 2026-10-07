import { useState } from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';

interface PressableBoxProps extends Omit<PressableProps, 'style'> {
  style?: StyleProp<ViewStyle>;
  /** Extra style while pressed. */
  pressedStyle?: StyleProp<ViewStyle>;
}

/**
 * Pressable with a plain (non-function) style. NativeWind's Pressable wrapper
 * drops `style={({ pressed }) => …}` on native, so pressed state is tracked
 * here instead.
 */
export function PressableBox({
  style,
  pressedStyle,
  onPressIn,
  onPressOut,
  ...rest
}: PressableBoxProps) {
  const [pressed, setPressed] = useState(false);
  return (
    <Pressable
      {...rest}
      onPressIn={(e) => {
        setPressed(true);
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        setPressed(false);
        onPressOut?.(e);
      }}
      style={[style, pressed && pressedStyle]}
    />
  );
}
