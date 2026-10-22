import { requireOptionalNativeModule } from 'expo-modules-core';

interface RoutlyAssistNative {
  isLocked(): boolean;
  revealAssist(): void;
  leaveAssist(): void;
  dismissAssist(): void;
  isOverlay(): boolean;
  dismissKeyguard(): Promise<boolean>;
}

/** Null on builds without close mode (older runtime, iOS, web): every call is then a no-op. */
const native = requireOptionalNativeModule<RoutlyAssistNative>('RoutlyAssist');

export const closeModeAvailable = native !== null;

/** Device locked right now (close mode opened over the lock screen). */
export const isLocked = (): boolean => native?.isLocked() ?? false;

/** /assist is on screen: remove the cover the ASSIST launch put up. */
export const revealAssist = (): void => native?.revealAssist();

/** Leaving /assist: the app may no longer show over the lock screen. */
export const leaveAssist = (): void => native?.leaveAssist();

/** Unlock before opening the full app; false when the user cancelled. */
export const dismissKeyguard = (): Promise<boolean> =>
  native ? native.dismissKeyguard() : Promise.resolve(true);

/** Close the overlay and go back to whatever was behind it (home, an app, the lock screen). */
export const dismissAssist = (): void => native?.dismissAssist();

/** /assist is a translucent overlay (false on older Android or builds without close mode). */
export const isOverlay = (): boolean => native?.isOverlay() ?? false;
