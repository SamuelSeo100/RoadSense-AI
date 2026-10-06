import { Children, Fragment, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { colors, radius } from '@/theme/routly';

/** White rounded list with 1px dividers between rows. */
export function GroupedList({ children }: { children: ReactNode }) {
  const rows = Children.toArray(children);
  return (
    <View style={styles.list}>
      {rows.map((row, i) => (
        <Fragment key={i}>
          {i > 0 && <View style={styles.divider} />}
          {row}
        </Fragment>
      ))}
    </View>
  );
}

interface ListRowProps {
  children: ReactNode;
  minHeight?: number;
  onPress?: () => void;
  accessibilityLabel?: string;
  accessibilityRole?: 'button' | 'link';
}

export function ListRow({
  children,
  minHeight = 60,
  onPress,
  accessibilityLabel,
  accessibilityRole = 'button',
}: ListRowProps) {
  const style = [styles.row, { minHeight }];
  if (!onPress) return <View style={style}>{children}</View>;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [style, pressed && styles.pressed]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  list: {
    backgroundColor: colors.surface,
    borderRadius: radius.cardSm,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  divider: { height: 1, backgroundColor: colors.divider, marginHorizontal: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14 },
  pressed: { backgroundColor: colors.background },
});
