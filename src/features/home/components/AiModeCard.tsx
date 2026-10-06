import { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Chip } from '@/components/routly/Chip';
import { Icon } from '@/components/routly/Icon';
import { RText } from '@/components/routly/RText';
import { Switch } from '@/components/routly/Switch';
import { colors, fonts, radius } from '@/theme/routly';

export const AI_SUGGESTIONS = [
  'Quickest to Pune Station',
  'Cheapest to college',
  'Take me home',
] as const;

interface AiModeCardProps {
  enabled: boolean;
  onToggle: (on: boolean) => void;
  showMic: boolean;
  onMic: () => void;
  onSubmit: (text: string) => void;
}

/** Dark card: free-text trip request, mic, suggestion chips. Collapses to its header when off. */
export function AiModeCard({ enabled, onToggle, showMic, onMic, onSubmit }: AiModeCardProps) {
  const [text, setText] = useState('');

  const submit = (value: string) => {
    if (value.trim()) onSubmit(value.trim());
  };

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.title}>
          <Icon name="sparkle" size={18} color={colors.accent} />
          <RText variant="cardTitle" color={colors.textOnPrimary}>
            AI Mode
          </RText>
        </View>
        <Switch
          value={enabled}
          onValueChange={onToggle}
          accessibilityLabel="AI Mode"
          surface="dark"
        />
      </View>

      {enabled && (
        <>
          <View style={styles.inputRow}>
            <BottomSheetTextInput
              value={text}
              onChangeText={setText}
              placeholder="Tell me the quickest way to Pune Station"
              placeholderTextColor={colors.dark.placeholder}
              accessibilityLabel="Ask Routly"
              returnKeyType="go"
              onSubmitEditing={() => submit(text)}
              style={styles.input}
            />
            {showMic && (
              <Pressable
                onPress={onMic}
                accessibilityRole="button"
                accessibilityLabel="Speak your destination"
                style={styles.mic}
              >
                <Icon name="mic" size={20} color={colors.textOnAccent} />
              </Pressable>
            )}
          </View>
          <View style={styles.chips}>
            {AI_SUGGESTIONS.map((s) => (
              <Chip
                key={s}
                label={s}
                height={36}
                surface="dark"
                onPress={() => {
                  setText(s);
                  submit(s);
                }}
              />
            ))}
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.dark.base, borderRadius: radius.card, padding: 16, gap: 12 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.dark.field,
    borderRadius: radius.input,
    paddingVertical: 6,
    paddingRight: 6,
    paddingLeft: 14,
  },
  input: {
    flex: 1,
    minWidth: 0,
    minHeight: 44,
    color: colors.textOnPrimary,
    fontFamily: fonts.medium,
    fontSize: 14,
    padding: 0,
  },
  mic: {
    width: 44,
    height: 44,
    borderRadius: radius.iconBtn,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
