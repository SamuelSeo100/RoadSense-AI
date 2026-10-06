import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { useFocusEffect } from 'expo-router';
import type { EffectCallback, ReactNode } from 'react';
import { StyleSheet } from 'react-native';

import { layout, spacing } from '@/theme/routly';

/**
 * Every tab is mounted inside the one shared sheet, so the sheet must follow
 * whichever tab's scroll view is focused. (gorhom passes a memoised effect.)
 */
function useFocusHook(effect: EffectCallback) {
  useFocusEffect(effect);
}

/** Scrollable sheet content: 16 side padding, 120 bottom padding to clear the nav bar. */
export function SheetScrollView({
  children,
  gap = spacing.xl,
}: {
  children: ReactNode;
  gap?: number;
}) {
  return (
    <BottomSheetScrollView
      focusHook={useFocusHook}
      contentContainerStyle={[styles.content, { gap }]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {children}
    </BottomSheetScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: 2,
    paddingHorizontal: spacing.screen,
    paddingBottom: layout.sheetContentBottomPadding,
  },
});
