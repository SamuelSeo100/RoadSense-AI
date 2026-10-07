import { StyleSheet, View } from 'react-native';

import { Icon } from '@/components/routly/Icon';
import { RText } from '@/components/routly/RText';
import type { RouteNotice, RouteSource } from '@/services';
import { colors, radius } from '@/theme/routly';

const sourceNames: Record<RouteSource, string> = {
  transit: 'bus & metro',
  road: 'auto & cab',
  bike: 'bike',
  walk: 'walking',
};

function noticeText(n: RouteNotice): string {
  switch (n.kind) {
    case 'transitUnavailable':
      return 'No buses or metro running now — showing road options';
    case 'metroClosed':
      return 'Metro is closed now — showing buses and road options';
    case 'partialFailure':
      return `Couldn’t load ${n.failed.map((s) => sourceNames[s]).join(', ')} options right now`;
  }
}

/** Small inline banner per notice, above the route list. */
export function RouteNotices({ notices }: { notices: RouteNotice[] }) {
  if (notices.length === 0) return null;
  return (
    <View style={styles.wrap} accessibilityRole="alert">
      {notices.map((n) => (
        <View key={n.kind} style={styles.banner}>
          <Icon name="info" size={16} color={colors.traffic.textModerate} />
          <RText variant="caption" color={colors.textTertiary} style={styles.text}>
            {noticeText(n)}
          </RText>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.surface,
    borderRadius: radius.tileSm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  text: { flex: 1 },
});
