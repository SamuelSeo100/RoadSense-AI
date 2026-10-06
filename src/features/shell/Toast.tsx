import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { FadeInDown, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { RText } from '@/components/routly/RText';
import { colors, fonts, layout, radius } from '@/theme/routly';

import { useShellStore } from './shellStore';

const VISIBLE_MS = 2400;

/** Short message above the nav bar ("Voice coming soon"). */
export function Toast() {
  const toast = useShellStore((s) => s.toast);
  const hideToast = useShellStore((s) => s.hideToast);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(hideToast, VISIBLE_MS);
    return () => clearTimeout(t);
  }, [toast, hideToast]);

  if (!toast) return null;
  return (
    <Animated.View
      key={toast.id}
      entering={FadeInDown.duration(180)}
      exiting={FadeOut.duration(150)}
      accessibilityLiveRegion="polite"
      accessibilityRole="alert"
      pointerEvents="none"
      style={[
        styles.toast,
        { bottom: insets.bottom + layout.navBar.bottomOffset + layout.navBar.height + 12 },
      ]}
    >
      <RText variant="body" size={13} family={fonts.bold} color={colors.textOnPrimary}>
        {toast.message}
      </RText>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    alignSelf: 'center',
    maxWidth: '90%',
    backgroundColor: colors.toastBg,
    borderRadius: radius.pill,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
});
