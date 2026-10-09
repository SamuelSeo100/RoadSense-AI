import { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

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
  /** The request text (typed, or the live voice transcript). */
  text: string;
  onChangeText: (text: string) => void;
  showMic: boolean;
  /** Listening for speech: the mic turns into a stop button. */
  listening?: boolean;
  /** Mic tapped, recognizer not ready yet: don't speak yet. */
  micStarting?: boolean;
  onMic: () => void;
  onSubmit: (text: string) => void;
  /** Parsing the request (the LLM call). */
  busy?: boolean;
  /** A follow-up question when the destination wasn't clear. */
  clarify?: { question: string; options: string[] } | null;
  onClarifyPick?: (option: string) => void;
}

/** Dark card: free-text trip request, mic, suggestion chips. Collapses to its header when off. */
export function AiModeCard({
  enabled,
  onToggle,
  text,
  onChangeText,
  showMic,
  listening = false,
  micStarting = false,
  onMic,
  onSubmit,
  busy = false,
  clarify,
  onClarifyPick,
}: AiModeCardProps) {
  const submit = (value: string) => {
    if (value.trim() && !busy) onSubmit(value.trim());
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
              onChangeText={onChangeText}
              placeholder={
                listening
                  ? 'Listening…'
                  : micStarting
                    ? 'Starting mic…'
                    : 'Tell me the quickest way to Pune Station'
              }
              placeholderTextColor={colors.dark.placeholder}
              accessibilityLabel="Ask Routly"
              returnKeyType="go"
              onSubmitEditing={() => submit(text)}
              style={styles.input}
            />
            {busy && (
              <ActivityIndicator
                color={colors.accent}
                accessibilityLabel="Understanding your request"
              />
            )}
            {showMic && (
              <Pressable
                onPress={onMic}
                accessibilityRole="button"
                accessibilityLabel={
                  listening
                    ? 'Stop listening'
                    : micStarting
                      ? 'Starting microphone'
                      : 'Speak your destination'
                }
                accessibilityState={{ busy: listening || micStarting }}
                style={[styles.mic, listening && styles.micListening]}
              >
                {listening ? (
                  <View style={styles.stopSquare} />
                ) : micStarting ? (
                  <ActivityIndicator color={colors.textOnAccent} />
                ) : (
                  <Icon name="mic" size={20} color={colors.textOnAccent} />
                )}
              </Pressable>
            )}
          </View>
          {clarify && (
            <View style={styles.clarify} accessibilityLiveRegion="polite">
              <RText variant="body" family={fonts.bold} color={colors.textOnPrimary}>
                {clarify.question}
              </RText>
              {clarify.options.length > 0 && (
                <View style={styles.chips}>
                  {clarify.options.map((o) => (
                    <Chip
                      key={o}
                      label={o}
                      height={36}
                      surface="dark"
                      onPress={() => onClarifyPick?.(o)}
                    />
                  ))}
                </View>
              )}
            </View>
          )}
          <View style={styles.chips}>
            {AI_SUGGESTIONS.map((s) => (
              <Chip
                key={s}
                label={s}
                height={36}
                surface="dark"
                onPress={() => {
                  onChangeText(s);
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
  micListening: {
    backgroundColor: colors.textOnPrimary,
    borderWidth: 3,
    borderColor: colors.accent,
  },
  stopSquare: { width: 14, height: 14, borderRadius: 3, backgroundColor: colors.danger },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  clarify: {
    gap: 10,
    borderLeftWidth: 3,
    borderLeftColor: colors.accent,
    paddingLeft: 10,
  },
});
