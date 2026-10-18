import * as Haptics from 'expo-haptics';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

/** "Get off at the next stop": a local notification + haptic, so it reaches a pocketed phone. */
const CHANNEL = 'trip-alerts';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

let prepared: Promise<void> | null = null;

/**
 * Channel + permission, once per app session: asked on "Start", before
 * navigation opens. The channel comes first: Android 13+ shows the
 * POST_NOTIFICATIONS prompt only once the app has a channel.
 */
export function prepareAlerts(): Promise<void> {
  prepared ??= (async () => {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(CHANNEL, {
        name: 'Trip alerts',
        description: 'Get off at the next stop',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 300, 200, 300],
      });
    }
    const current = await Notifications.getPermissionsAsync();
    if (!current.granted && current.canAskAgain) await Notifications.requestPermissionsAsync();
  })().catch(() => {
    prepared = null;
  });
  return prepared;
}

const content = (stop: string): Notifications.NotificationContentInput => ({
  title: 'Get off at the next stop',
  body: stop,
  sound: true,
  // Heads-up on Android < 8 (8+ takes it from the HIGH channel).
  priority: Notifications.AndroidNotificationPriority.HIGH,
});

/** Now, from a GPS-detected approach. */
export async function alightAlertNow(stop: string) {
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
  await Notifications.scheduleNotificationAsync({
    content: content(stop),
    trigger: Platform.OS === 'android' ? { channelId: CHANNEL } : null,
  }).catch(() => {});
}

/**
 * Time-based backup at the predicted moment (fires with the screen off,
 * when foreground GPS has stopped). Returns its id, to cancel it.
 */
export async function scheduleAlightBackup(stop: string, at: Date): Promise<string | null> {
  try {
    return await Notifications.scheduleNotificationAsync({
      content: content(stop),
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: at,
        channelId: CHANNEL,
      },
    });
  } catch {
    return null;
  }
}

export function cancelAlert(id: string | null) {
  if (id) void Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
}
