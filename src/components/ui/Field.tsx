import type { ReactNode } from 'react';
import { View } from 'react-native';

import { Icon, type IconName } from './Icon';
import { Text } from './Text';

export interface FieldProps {
  label?: string;
  /** Hint under the field. Replaced by `error` when present. */
  helper?: string;
  helperIcon?: IconName;
  error?: string;
  /** Appends a muted "(optional)" to the label. */
  optional?: boolean;
  /** Used to link label and input on web. */
  nativeID?: string;
  children: ReactNode;
}

/** Label + control + helper/error row, shared by all form inputs. */
export function Field({
  label,
  helper,
  helperIcon,
  error,
  optional = false,
  nativeID,
  children,
}: FieldProps) {
  return (
    <View className="gap-1.5">
      {label ? (
        <Text variant="label-md" tone="on-surface-variant" weight="medium" nativeID={nativeID}>
          {label}
          {optional ? (
            <Text variant="label-md" tone="outline" weight="regular">
              {' '}
              (optional)
            </Text>
          ) : null}
        </Text>
      ) : null}
      {children}
      {error ? (
        <View className="flex-row items-center gap-1.5 px-0.5" accessibilityLiveRegion="polite">
          <Icon name="error-outline" size={14} tone="error" />
          <Text variant="body-sm" tone="error" className="flex-1" accessibilityRole="alert">
            {error}
          </Text>
        </View>
      ) : helper ? (
        <View className="flex-row items-center gap-1.5 px-0.5">
          {helperIcon ? <Icon name={helperIcon} size={14} tone="primary" /> : null}
          <Text variant="body-sm" tone="on-surface-variant" className="flex-1">
            {helper}
          </Text>
        </View>
      ) : null}
    </View>
  );
}
