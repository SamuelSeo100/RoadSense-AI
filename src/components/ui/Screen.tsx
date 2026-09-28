import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { cn } from '@/lib/cn';
import { spacing } from '@/theme/tokens';

interface ScreenProps {
  children: ReactNode;
  /** Fixed bar above the scroll area (e.g. `<AppHeader />`). */
  header?: ReactNode;
  /** Wrap content in a ScrollView (default true). */
  scroll?: boolean;
  /** Apply the 16dp page margin and top spacing (default true). Turn off for full-bleed layouts. */
  padded?: boolean;
  /** Page background: `surface` (default) or white, for long forms of tonal inputs. */
  background?: 'surface' | 'surface-container-lowest';
  /** Extra classes for the content container. */
  contentClassName?: string;
}

const backgroundClassNames = {
  surface: 'bg-surface',
  'surface-container-lowest': 'bg-surface-container-lowest',
} as const;

/**
 * Page wrapper:
 * - The top safe-area inset is solid padding on the outer view, so scrolled
 *   content is clipped below the status bar instead of sliding under it.
 * - Keyboard avoidance for forms on both platforms (Android is edge-to-edge,
 *   so window resizing alone isn't enough).
 */
export function Screen({
  children,
  header,
  scroll = true,
  padded = true,
  background = 'surface',
  contentClassName,
}: ScreenProps) {
  const insets = useSafeAreaInsets();
  const bottomPadding = { paddingBottom: insets.bottom + spacing['space-xl'] };
  const contentClasses = cn(padded && 'px-margin pt-space-lg', contentClassName);

  return (
    <View
      className={cn('flex-1', backgroundClassNames[background])}
      style={{ paddingTop: insets.top }}
    >
      {header}
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {scroll ? (
          <ScrollView
            className="flex-1"
            contentContainerClassName={contentClasses}
            contentContainerStyle={bottomPadding}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
          >
            {children}
          </ScrollView>
        ) : (
          <View className={cn('flex-1', contentClasses)} style={bottomPadding}>
            {children}
          </View>
        )}
      </KeyboardAvoidingView>
    </View>
  );
}
