import { Alert, Platform } from 'react-native';

/** Yes/no confirmation that also works on web (where Alert buttons are unsupported). */
export function confirm(title: string, message: string, confirmLabel: string): Promise<boolean> {
  if (Platform.OS === 'web') {
    return Promise.resolve(
      typeof window !== 'undefined' && window.confirm(`${title}\n\n${message}`),
    );
  }
  return new Promise((resolve) => {
    Alert.alert(
      title,
      message,
      [
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
        { text: confirmLabel, style: 'destructive', onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}

/** Pick one of several options (native action alert; first option on web). */
export function choose<T extends string>(
  title: string,
  options: readonly { value: T; label: string }[],
): Promise<T | null> {
  if (Platform.OS === 'web') return Promise.resolve(options[0]?.value ?? null);
  return new Promise((resolve) => {
    Alert.alert(
      title,
      undefined,
      [
        ...options.map((o) => ({ text: o.label, onPress: () => resolve(o.value) })),
        { text: 'Cancel', style: 'cancel' as const, onPress: () => resolve(null) },
      ],
      { cancelable: true, onDismiss: () => resolve(null) },
    );
  });
}
