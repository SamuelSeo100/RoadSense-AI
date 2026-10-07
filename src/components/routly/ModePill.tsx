import { StyleSheet, View } from 'react-native';

import { fonts, modeColors, type Mode } from '@/theme/routly';

import { Icon, modeIcon } from './Icon';
import { RText } from './RText';

/** Coloured leg label: "Walk 5m", "Metro", "Bus 312", optionally with the mode icon. */
export function ModePill({ mode, label, icon }: { mode: Mode; label: string; icon?: boolean }) {
  const c = modeColors[mode];
  return (
    <View style={[styles.pill, icon && styles.withIcon, { backgroundColor: c.pillBg }]}>
      {icon && <Icon name={modeIcon[mode]} size={14} color={c.pillText} strokeWidth={2.2} />}
      <RText variant="body" size={12} family={fonts.bold} color={c.pillText} numberOfLines={1}>
        {label}
      </RText>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, maxWidth: '100%' },
  withIcon: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingLeft: 8 },
});
