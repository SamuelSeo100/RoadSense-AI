import { StyleSheet, View } from 'react-native';

import { Chip } from '@/components/routly/Chip';
import { RText } from '@/components/routly/RText';
import { Switch } from '@/components/routly/Switch';
import { PRIORITIES, priorityLabels, type Preferences } from '@/services';
import { colors, fonts, radius } from '@/theme/routly';

type ToggleKey = 'learnFromTrips' | 'voiceForAiMode' | 'liveTrafficAlerts';

const toggles: { key: ToggleKey; title: string; hint: string }[] = [
  {
    key: 'learnFromTrips',
    title: 'Learn from my trips',
    hint: 'Personalise route ranking with your history',
  },
  {
    key: 'voiceForAiMode',
    title: 'Voice for AI Mode',
    hint: 'Speak your destination instead of typing',
  },
  {
    key: 'liveTrafficAlerts',
    title: 'Live traffic alerts',
    hint: 'Warn me when my route slows down',
  },
];

interface PreferencesCardProps {
  prefs: Preferences;
  onChange: (patch: Partial<Preferences>) => void;
}

/** Default priority + travel toggles (all persisted). */
export function PreferencesCard({ prefs, onChange }: PreferencesCardProps) {
  return (
    <View style={styles.card}>
      <View style={styles.group}>
        <RText variant="sectionLabel" size={12}>
          Default priority
        </RText>
        <View style={styles.chips} accessibilityRole="radiogroup">
          {PRIORITIES.map((p) => (
            <Chip
              key={p}
              label={priorityLabels[p]}
              height={38}
              selected={p === prefs.defaultPriority}
              onPress={() => onChange({ defaultPriority: p })}
            />
          ))}
        </View>
      </View>
      {toggles.map((t) => (
        <View key={t.key} style={styles.toggleRow}>
          <View style={styles.toggleText}>
            <RText variant="body" family={fonts.extrabold}>
              {t.title}
            </RText>
            <RText variant="caption">{t.hint}</RText>
          </View>
          <Switch
            value={prefs[t.key]}
            onValueChange={(on) => onChange({ [t.key]: on })}
            accessibilityLabel={t.title}
          />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.cardSm,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 14,
  },
  group: { gap: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    paddingTop: 12,
  },
  toggleText: { flex: 1, gap: 2 },
});
