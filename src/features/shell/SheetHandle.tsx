import { Pressable, StyleSheet, View } from 'react-native';

import { colors } from '@/theme/routly';

interface SheetHandleProps {
  expanded: boolean;
  onToggle: () => void;
}

/** 30pt drag handle. Dragging moves the sheet (gorhom); tapping toggles peek/full. */
export function SheetHandle({ expanded, onToggle }: SheetHandleProps) {
  return (
    <Pressable
      onPress={onToggle}
      accessibilityRole="button"
      accessibilityLabel="Drag or tap to expand the panel"
      accessibilityState={{ expanded }}
      style={styles.hit}
    >
      <View style={styles.pill} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hit: { height: 30, alignItems: 'center', justifyContent: 'center' },
  pill: { width: 40, height: 5, borderRadius: 3, backgroundColor: colors.handle },
});
