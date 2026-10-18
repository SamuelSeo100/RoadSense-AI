import * as Speech from 'expo-speech';

import type { NavEvent } from '@/navigation/engine';

/** English for now (Indian English voice where the device has one). */
const LANGUAGE = 'en-IN';

/** What to say for an engine event, or null. */
export function phraseFor(
  event: NavEvent,
  destinationName: string,
  /** A new route is being computed (false once the 5 reroutes per trip are used). */
  rerouting = true,
): string | null {
  switch (event.type) {
    case 'stepStart': {
      const t = event.step.transit;
      if (!t) return event.step.instruction;
      const towards = t.headsign ? ` towards ${t.headsign}` : '';
      return `Board the ${t.line}${towards}`;
    }
    case 'approachTurn':
      return `In 100 metres, ${event.next.instruction}`;
    case 'alightSoon':
      return `Get off at next stop: ${event.stop}`;
    case 'offRoute':
      return rerouting ? 'You are off the route. Finding a new one.' : 'You are off the route.';
    case 'arrived':
      return `You have arrived at ${destinationName}`;
    default:
      return null;
  }
}

/** Speaks now, cutting off anything older (navigation prompts go stale fast). */
export function say(text: string) {
  void Speech.stop().finally(() => Speech.speak(text, { language: LANGUAGE }));
}

export function silence() {
  void Speech.stop();
}
