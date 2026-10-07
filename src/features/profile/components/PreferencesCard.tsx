import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Chip } from '@/components/routly/Chip';
import { Icon } from '@/components/routly/Icon';
import { RText } from '@/components/routly/RText';
import { Switch } from '@/components/routly/Switch';
import { PRIORITIES, priorityLabels, type Preferences } from '@/services';
import { colors, fonts, radius } from '@/theme/routly';

type ToggleKey = 'learnFromTrips' | 'voiceForAiMode' | 'liveTrafficAlerts';

/** What each colour of Google's live traffic layer means. */
const trafficKey = [
  { color: colors.trafficLayer.free, label: 'Green', meaning: 'Traffic flowing freely' },
  { color: colors.trafficLayer.moderate, label: 'Orange', meaning: 'Moderate, some slowdowns' },
  { color: colors.trafficLayer.heavy, label: 'Red', meaning: 'Heavy, slow-moving traffic' },
  { color: colors.trafficLayer.stopped, label: 'Dark red', meaning: 'Very heavy or stop-and-go' },
] as const;

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
  const [showKey, setShowKey] = useState(false);
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
      <View style={styles.trafficGroup}>
        <View style={styles.trafficRow}>
          <View style={styles.toggleText}>
            <View style={styles.titleRow}>
              <RText variant="body" family={fonts.extrabold}>
                Show traffic on map
              </RText>
              <Pressable
                onPress={() => setShowKey((v) => !v)}
                accessibilityRole="button"
                accessibilityLabel="What the traffic colours mean"
                accessibilityState={{ expanded: showKey }}
                hitSlop={12}
                style={styles.infoButton}
              >
                <Icon
                  name="info"
                  size={18}
                  color={showKey ? colors.primary : colors.iconInactive}
                />
              </Pressable>
            </View>
            <RText variant="caption">Live traffic lines on roads</RText>
          </View>
          <Switch
            value={prefs.showTraffic}
            onValueChange={(showTraffic) => onChange({ showTraffic })}
            accessibilityLabel="Show traffic on map"
          />
        </View>
        {showKey && (
          <View style={styles.key} accessibilityRole="list">
            {trafficKey.map((k) => (
              <View
                key={k.label}
                style={styles.keyRow}
                accessible
                accessibilityLabel={`${k.label}: ${k.meaning}`}
              >
                <View style={[styles.keyBar, { backgroundColor: k.color }]} />
                <RText variant="body" size={13} family={fonts.bold} style={styles.keyLabel}>
                  {k.label}
                </RText>
                <RText variant="caption" style={styles.flex}>
                  {k.meaning}
                </RText>
              </View>
            ))}
          </View>
        )}
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
  trafficGroup: { borderTopWidth: 1, borderTopColor: colors.divider, paddingTop: 12, gap: 10 },
  trafficRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  infoButton: { padding: 2 },
  key: { backgroundColor: colors.background, borderRadius: radius.tileSm, padding: 12, gap: 10 },
  keyRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  keyBar: { width: 22, height: 6, borderRadius: 3 },
  keyLabel: { width: 70 },
  flex: { flex: 1 },
});
