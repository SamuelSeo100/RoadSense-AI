import { StyleSheet, View } from 'react-native';

import { colors } from '@/theme/routly';

/**
 * From→To rail: blue origin dot, dashed line, red destination square.
 * `size` 12 + `line` 38 on Home's panel, 10 + 22 on Routes.
 */
export function RouteRail({ size = 12, line = 38 }: { size?: number; line?: number }) {
  const dashes = Math.max(2, Math.floor(line / 6));
  return (
    <View
      style={styles.rail}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <View
        style={[styles.origin, { width: size + 6, height: size + 6, borderRadius: (size + 6) / 2 }]}
      >
        <View
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: colors.userLocation,
          }}
        />
      </View>
      <View style={[styles.line, { height: line }]}>
        {Array.from({ length: dashes }, (_, i) => (
          <View key={i} style={styles.dash} />
        ))}
      </View>
      <View
        style={{ width: size, height: size, borderRadius: 3, backgroundColor: colors.destination }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  rail: { alignItems: 'center' },
  origin: { backgroundColor: colors.originRing, alignItems: 'center', justifyContent: 'center' },
  line: { justifyContent: 'space-evenly', alignItems: 'center', marginVertical: 2 },
  dash: { width: 2, height: 3, borderRadius: 1, backgroundColor: colors.railDash },
});
