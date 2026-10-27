// Dictating a message instead of typing it, for when the hands or the moment do not allow typing
// (ADR-0040). The browser's own speech recognition does the work: on Android Google's, on iPhone
// Apple's, both reliable in Spanish. They send the voice to their service, so dictation needs a
// connection on most phones; what is transcribed stays in the text box until it is sent like any
// message, encrypted. Browsers without it (Firefox) show no dictation button.

import type { Locale } from '../i18n/index.ts';

/** What the browser's recognizer exposes; TypeScript's DOM types lack the class itself. */
interface Recognizer {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

export type RecognizerClass = new () => Recognizer;

/** Why dictation stopped without text, as the user can act on it. */
export type DictationProblem = 'permission' | 'network' | 'silence' | 'unavailable';

/** The language each interface language dictates in. */
const SPEECH_LANGUAGES: Readonly<Record<Locale, string>> = { es: 'es-ES', en: 'en-GB' };

/** The browser's speech recognizer, or null if it has none. */
export function speechRecognizer(): RecognizerClass | null {
  const scope = globalThis as {
    SpeechRecognition?: RecognizerClass;
    webkitSpeechRecognition?: RecognizerClass;
  };
  return scope.SpeechRecognition ?? scope.webkitSpeechRecognition ?? null;
}

function problemOf(error: SpeechRecognitionErrorCode): DictationProblem | null {
  switch (error) {
    case 'not-allowed':
    case 'service-not-allowed':
      return 'permission';
    case 'network':
      return 'network';
    case 'no-speech':
      return 'silence';
    case 'aborted':
      return null;
    case 'audio-capture':
    case 'language-not-supported':
    case 'phrases-not-supported':
      return 'unavailable';
  }
}

/** The text so far: what was there before dictating, then everything heard, said or still guessed. */
export function dictatedText(before: string, results: SpeechRecognitionResultList): string {
  const heard = Array.from(results, (result) => result[0]?.transcript ?? '').join('');
  const lead = before.trim();
  return [lead, heard.trim()].filter((part) => part !== '').join(' ');
}

export class Dictation {
  listening = $state(false);
  problem: DictationProblem | null = $state(null);

  readonly #Recognizer: RecognizerClass;
  #recognizer: Recognizer | null = null;

  constructor(Recognizer: RecognizerClass) {
    this.#Recognizer = Recognizer;
  }

  /** Listens until `stop`, passing the whole text each time more is heard. */
  start(locale: Locale, before: string, ontext: (text: string) => void): void {
    this.cancel();
    const recognizer = new this.#Recognizer();
    recognizer.lang = SPEECH_LANGUAGES[locale];
    recognizer.continuous = true;
    recognizer.interimResults = true;
    recognizer.onresult = (event) => {
      // A recognizer cancelled may still report; what it says is no longer wanted.
      if (this.#recognizer === recognizer) ontext(dictatedText(before, event.results));
    };
    recognizer.onerror = (event) => {
      this.problem = problemOf(event.error);
    };
    recognizer.onend = () => {
      if (this.#recognizer !== recognizer) return;
      this.#recognizer = null;
      this.listening = false;
    };
    this.problem = null;
    this.#recognizer = recognizer;
    this.listening = true;
    recognizer.start();
  }

  /** Stops listening; what was heard until now is kept. */
  stop(): void {
    this.#recognizer?.stop();
  }

  /** Stops listening and drops what was still being heard, as when sending or closing the chat. */
  cancel(): void {
    const recognizer = this.#recognizer;
    this.#recognizer = null;
    this.listening = false;
    recognizer?.abort();
  }
}
