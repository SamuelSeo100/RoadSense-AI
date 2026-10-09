import Constants from 'expo-constants';
import * as Updates from 'expo-updates';

/** What testers report: app version, plus which OTA update and runtime they're on. */
export const appVersion = Constants.expoConfig?.version ?? 'unknown';

/** EAS Update channel baked into the build ("preview"); null in dev builds. */
export const updateChannel: string | null = Updates.isEnabled ? (Updates.channel ?? null) : null;

/** EAS preview builds (also after an OTA update, unlike the build-time profile). */
export const isPreviewBuild =
  updateChannel === 'preview' ||
  (Constants.expoConfig?.extra as { buildProfile?: string } | undefined)?.buildProfile ===
    'preview';

/** "Update 3f2a9c1e · runtime 4b1d…" or "Built-in bundle · runtime …"; null in dev. */
export function updateLabel(): string | null {
  if (!Updates.isEnabled) return null;
  const runtime = Updates.runtimeVersion ? `runtime ${Updates.runtimeVersion.slice(0, 12)}` : null;
  const update =
    Updates.isEmbeddedLaunch || !Updates.updateId
      ? 'Built-in bundle'
      : `Update ${Updates.updateId.slice(0, 8)}`;
  return [update, runtime].filter(Boolean).join(' · ');
}

export const updateInfo = {
  updateId: Updates.isEnabled ? (Updates.updateId ?? null) : null,
  runtimeVersion: Updates.isEnabled ? (Updates.runtimeVersion ?? null) : null,
  embedded: Updates.isEnabled ? Updates.isEmbeddedLaunch : true,
};
