import {
  ExpoSpeechRecognitionModule,
  RecognizerIntentEnableLanguageSwitch,
  useSpeechRecognitionEvent,
  type ExpoSpeechRecognitionErrorCode,
  type ExpoSpeechRecognitionOptions,
} from 'expo-speech-recognition';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Linking, Platform } from 'react-native';

/** Primary locale, plus the alternates Android may switch to mid-utterance. */
const LOCALE = 'en-IN';
const ALTERNATE_LOCALES = ['hi-IN', 'mr-IN'];
/** Silence after the last words before the request is sent. */
const SILENCE_MS = 1500;
/** Words the recognizer should expect (Android 13+ biasing). */
const PUNE_WORDS = [
  'Swargate',
  'Shivajinagar',
  'Hinjewadi',
  'Kothrud',
  'Viman Nagar',
  'FC Road',
  'JM Road',
  'Pune station',
  'Deccan',
  'Baner',
  'Wakad',
  'Hadapsar',
  'Kharadi',
  'ghar',
  'college',
  'metro',
  'sabse sasta',
  'jaana hai',
  'jaycha aahe',
];

const errorMessages: Partial<Record<ExpoSpeechRecognitionErrorCode, string>> = {
  'no-speech': 'Didn’t catch that. Tap the mic and try again.',
  'speech-timeout': 'Didn’t catch that. Tap the mic and try again.',
  network: 'Voice needs an internet connection on this phone.',
  'language-not-supported': 'Voice isn’t available in English (India) on this phone.',
  'service-not-allowed': 'Speech recognition isn’t available on this phone.',
  'audio-capture': 'Couldn’t use the microphone. Is another app using it?',
  busy: 'The microphone is busy. Try again in a moment.',
};

/** Dev builds: trace the recognizer session in the Metro log (no transcripts). */
const trace = (event: string, detail = '') => {
  if (__DEV__) console.info(`[voice] ${event}${detail ? ` ${detail}` : ''}`);
};

let localesPromise: Promise<ExpoSpeechRecognitionOptions> | null = null;

/**
 * On-device recognition when en-IN is installed (audio stays on the phone),
 * with language switching to whichever of hi-IN / mr-IN are installed.
 * Otherwise the default (network) recognizer in en-IN.
 */
function recognitionOptions(): Promise<ExpoSpeechRecognitionOptions> {
  localesPromise ??= (async (): Promise<ExpoSpeechRecognitionOptions> => {
    if (Platform.OS !== 'android' || !ExpoSpeechRecognitionModule.supportsOnDeviceRecognition()) {
      return {};
    }
    try {
      const { installedLocales } = await ExpoSpeechRecognitionModule.getSupportedLocales({});
      const installed = new Set(installedLocales.map((l) => l.toLowerCase()));
      if (!installed.has(LOCALE.toLowerCase())) return {};
      const alternates = ALTERNATE_LOCALES.filter((l) => installed.has(l.toLowerCase()));
      return {
        requiresOnDeviceRecognition: true,
        androidIntentOptions: alternates.length
          ? {
              EXTRA_ENABLE_LANGUAGE_SWITCH:
                RecognizerIntentEnableLanguageSwitch.LANGUAGE_SWITCH_BALANCED,
              EXTRA_LANGUAGE_SWITCH_ALLOWED_LANGUAGES: [LOCALE, ...alternates],
            }
          : undefined,
      };
    } catch {
      return {};
    }
  })();
  return localesPromise;
}

async function ensurePermission(): Promise<boolean> {
  const current = await ExpoSpeechRecognitionModule.getPermissionsAsync();
  if (current.granted) return true;
  const asked = current.canAskAgain
    ? await ExpoSpeechRecognitionModule.requestPermissionsAsync()
    : current;
  if (asked.granted) return true;
  Alert.alert(
    'Microphone is off',
    'To speak your destination, allow Routly to use the microphone. You can still type in AI Mode.',
    asked.canAskAgain
      ? [{ text: 'OK' }]
      : [
          { text: 'Not now', style: 'cancel' },
          { text: 'Open settings', onPress: () => void Linking.openSettings() },
        ],
  );
  return false;
}

interface VoiceInputOptions {
  /** Live (partial) transcript, for the text box. */
  onTranscript: (text: string) => void;
  /** The final transcript, after 1.5 s of silence or a second tap. */
  onDone: (text: string) => void;
  onError: (message: string) => void;
}

/**
 * Tap-to-talk speech-to-text for AI Mode: `toggle()` starts listening, a
 * second `toggle()` stops and submits. Also submits after 1.5 s of silence.
 */
export function useVoiceInput({ onTranscript, onDone, onError }: VoiceInputOptions) {
  const [listening, setListening] = useState(false);
  /** Tapped, but the recognizer hasn't started yet (permission, locale check). */
  const [starting, setStarting] = useState(false);
  const transcript = useRef('');
  const silenceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Set once this session's text was handed over (no double submit). */
  const finished = useRef(false);
  // Latest callbacks without re-subscribing the native listeners.
  const callbacks = useRef({ onTranscript, onDone, onError });
  useEffect(() => {
    callbacks.current = { onTranscript, onDone, onError };
  });

  const clearSilence = () => {
    if (silenceTimer.current) clearTimeout(silenceTimer.current);
    silenceTimer.current = null;
  };

  const finish = useCallback(() => {
    clearSilence();
    if (finished.current) return;
    finished.current = true;
    ExpoSpeechRecognitionModule.stop();
    const text = transcript.current.trim();
    if (text) callbacks.current.onDone(text);
  }, []);

  useSpeechRecognitionEvent('start', () => {
    trace('start');
    setStarting(false);
    setListening(true);
  });
  useSpeechRecognitionEvent('end', () => {
    trace('end', `words=${transcript.current.trim().split(/\s+/).filter(Boolean).length}`);
    setListening(false);
    // The recognizer ended on its own (e.g. final result): submit what we have.
    finish();
  });
  useSpeechRecognitionEvent('result', (e) => {
    trace('result', `final=${e.isFinal} chars=${e.results[0]?.transcript.length ?? 0}`);
    const text = e.results[0]?.transcript ?? '';
    if (!text || finished.current) return;
    transcript.current = text;
    callbacks.current.onTranscript(text);
    clearSilence();
    silenceTimer.current = setTimeout(finish, SILENCE_MS);
  });
  useSpeechRecognitionEvent('error', (e) => {
    trace('error', `${e.error} (${e.code ?? '-'}) ${e.message}`);
    clearSilence();
    setStarting(false);
    setListening(false);
    if (e.error === 'aborted') return;
    // Words were heard before the error: still use them.
    if (transcript.current.trim() && !finished.current) {
      finish();
      return;
    }
    finished.current = true;
    callbacks.current.onError(errorMessages[e.error] ?? 'Voice input stopped. Try again.');
  });

  useEffect(
    () => () => {
      clearSilence();
      ExpoSpeechRecognitionModule.abort();
    },
    [],
  );

  const start = useCallback(async () => {
    setStarting(true);
    if (!(await ensurePermission())) {
      setStarting(false);
      return;
    }
    transcript.current = '';
    finished.current = false;
    const extra = await recognitionOptions();
    trace(
      'options',
      `onDevice=${extra.requiresOnDeviceRecognition === true} switch=${
        extra.androidIntentOptions?.EXTRA_LANGUAGE_SWITCH_ALLOWED_LANGUAGES?.join('/') ?? 'none'
      }`,
    );
    ExpoSpeechRecognitionModule.start({
      lang: LOCALE,
      interimResults: true,
      // One utterance per tap. Continuous (segmented) sessions returned empty
      // segments on Android after the first one.
      continuous: false,
      maxAlternatives: 1,
      contextualStrings: PUNE_WORDS,
      // Silence is handled by our own timer: Google's recognizer ended the
      // session with "no match" as speech began when given a silence length.
      ...extra,
    });
  }, []);

  const toggle = useCallback(() => {
    if (listening) finish();
    else if (!starting) void start();
  }, [listening, starting, finish, start]);

  return { listening, starting, toggle };
}
