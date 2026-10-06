import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { RText } from './RText';

/** "Routes to Pune Station" + optional trailing action. */
export function SectionHeader({
  title,
  size = 17,
  right,
}: {
  title: string;
  size?: number;
  right?: ReactNode;
}) {
  return (
    <View style={styles.row}>
      <RText
        variant="sectionTitle"
        size={size}
        accessibilityRole="header"
        style={styles.title}
        numberOfLines={1}
      >
        {title}
      </RText>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  title: { flexShrink: 1 },
});
