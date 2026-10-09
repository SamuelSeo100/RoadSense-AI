import { Children, Fragment, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { colors, radius } from '@/theme/routly';
import { PressableBox } from '@/components/routly/PressableBox';

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
  onLongPress?: () => void;
  accessibilityLabel?: string;
  accessibilityRole?: 'button' | 'link';
}

export function ListRow({
  children,
  minHeight = 60,
  onPress,
  onLongPress,
  accessibilityLabel,
  accessibilityRole = 'button',
}: ListRowProps) {
  const style = [styles.row, { minHeight }];
  if (!onPress && !onLongPress) return <View style={style}>{children}</View>;
  return (
    <PressableBox
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      style={style}
      pressedStyle={styles.pressed}
    >
      {children}
    </PressableBox>
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
