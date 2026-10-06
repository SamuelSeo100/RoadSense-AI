import { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import type { Ref } from 'react';
import { StyleSheet, View, type TextInput } from 'react-native';

import { IconButton } from '@/components/routly/IconButton';
import { RouteRail } from '@/components/routly/RouteRail';
import { RText } from '@/components/routly/RText';
import { colors, fonts, radius } from '@/theme/routly';

interface FromToCardProps {
  from: string;
  to: string;
  onChangeFrom: (v: string) => void;
  onChangeTo: (v: string) => void;
  onSubmit: () => void;
  onSwap: () => void;
  fromRef?: Ref<TextInput>;
}

/** Editable From/To with a rail and a swap button (Routes tab). */
export function FromToCard({
  from,
  to,
  onChangeFrom,
  onChangeTo,
  onSubmit,
  onSwap,
  fromRef,
}: FromToCardProps) {
  return (
    <View style={styles.card}>
      <RouteRail size={10} line={22} />
      <View style={styles.fields}>
        <View style={styles.field}>
          <RText variant="fieldLabel">From</RText>
          <BottomSheetTextInput
            // gorhom's input forwards the TextInput ref.
            ref={fromRef as Ref<never>}
            value={from}
            onChangeText={onChangeFrom}
            placeholder="Current location"
            placeholderTextColor={colors.textSecondary}
            accessibilityLabel="From"
            returnKeyType="search"
            onSubmitEditing={onSubmit}
            selectTextOnFocus
            style={styles.input}
          />
        </View>
        <View style={styles.divider} />
        <View style={styles.field}>
          <RText variant="fieldLabel">To</RText>
          <BottomSheetTextInput
            value={to}
            onChangeText={onChangeTo}
            placeholder="Where to?"
            placeholderTextColor={colors.textSecondary}
            accessibilityLabel="To"
            returnKeyType="search"
            onSubmitEditing={onSubmit}
            selectTextOnFocus
            style={styles.input}
          />
        </View>
      </View>
      <IconButton icon="swap" accessibilityLabel="Swap From and To" onPress={onSwap} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.cardSm,
    paddingTop: 10,
    paddingRight: 8,
    paddingBottom: 10,
    paddingLeft: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  fields: { flex: 1 },
  field: { paddingVertical: 4, gap: 1 },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 4 },
  input: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.textPrimary,
    padding: 0,
    minHeight: 22,
  },
});
