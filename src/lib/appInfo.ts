import Constants from 'expo-constants';
import * as Updates from 'expo-updates';

/** What testers report: app version, plus which OTA update and runtime they're on. */
export const appVersion = Constants.expoConfig?.version ?? 'unknown';

/** EAS Update channel baked into the build ("preview"); null in dev builds. */
export const updateChannel: string | null = Updates.isEnabled ? (Updates.channel ?? null) : null;

/** EAS preview builds: the update channel is baked into the build (and survives OTA updates). */
export const isPreviewBuild = updateChannel === 'preview';

/**
 * Which bundle is running: "1.0.0 · preview · runtime 18177b8f · OTA 01a16404" (an EAS
 * update) or "… · embedded 3f2a9c1e" (the bundle the build shipped with).
 * Dev: "1.0.0 · dev (Metro)".
 */
export function buildInfoLabel(): string {
  if (!Updates.isEnabled) return `${appVersion} · dev (Metro)`;
  const short = (id: string | null | undefined) => (id ? id.slice(0, 8) : 'none');
  return [
    appVersion,
    updateChannel ?? 'no channel',
    `runtime ${short(Updates.runtimeVersion)}`,
    `${Updates.isEmbeddedLaunch ? 'embedded' : 'OTA'} ${short(Updates.updateId)}`,
  ].join(' · ');
}

export const updateInfo = {
  updateId: Updates.isEnabled ? (Updates.updateId ?? null) : null,
  runtimeVersion: Updates.isEnabled ? (Updates.runtimeVersion ?? null) : null,
  embedded: Updates.isEnabled ? Updates.isEmbeddedLaunch : true,
};
