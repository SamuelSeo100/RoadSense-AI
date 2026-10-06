import { StyleSheet, View } from 'react-native';

import { fonts, modeColors, type Mode } from '@/theme/routly';

import { RText } from './RText';

/** Coloured leg label: "Walk 5m", "Metro", "Bus 312". */
export function ModePill({ mode, label }: { mode: Mode; label: string }) {
  const c = modeColors[mode];
  return (
    <View style={[styles.pill, { backgroundColor: c.pillBg }]}>
      <RText variant="body" size={12} family={fonts.bold} color={c.pillText}>
        {label}
      </RText>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8 },
});
