import { describe, expect, it } from 'vitest';

import { Dictation, dictatedText, type RecognizerClass } from './dictation.svelte.ts';

/** Results as the browser lists them: each with its best guess first. */
const results = (...heard: string[]) =>
  heard.map((transcript) => [{ transcript }]) as unknown as SpeechRecognitionResultList;

/** A recognizer the test speaks through; the last one made is `FakeRecognizer.last`. */
class FakeRecognizer {
  static last: FakeRecognizer | null = null;
  lang = '';
  continuous = false;
  interimResults = false;
  onresult: ((event: SpeechRecognitionEvent) => void) | null = null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null = null;
  onend: (() => void) | null = null;
  constructor() {
    FakeRecognizer.last = this;
  }
  start(): void {}
  stop(): void {
    this.onend?.();
  }
  abort(): void {
    this.onend?.();
  }
  hear(...heard: string[]): void {
    this.onresult?.({ results: results(...heard) } as SpeechRecognitionEvent);
  }
  fail(error: SpeechRecognitionErrorCode): void {
    this.onerror?.({ error } as SpeechRecognitionErrorEvent);
    this.onend?.();
  }
}

const Fake = FakeRecognizer as unknown as RecognizerClass;

describe('dictation', () => {
  it('puts what is heard after what was typed', () => {
    expect(dictatedText('Bloqueado', results('el acceso ', 'norte'))).toBe(
      'Bloqueado el acceso norte',
    );
    expect(dictatedText('', results(' necesitamos agua'))).toBe('necesitamos agua');
  });

  it('listens in Spanish and passes the whole text as it grows', () => {
    const dictation = new Dictation(Fake);
    const texts: string[] = [];
    dictation.start('es', '', (text) => texts.push(text));
    const recognizer = FakeRecognizer.last;
    expect(recognizer?.lang).toBe('es-ES');
    expect(dictation.listening).toBe(true);
    recognizer?.hear('herido ');
    recognizer?.hear('herido ', 'en el puente');
    expect(texts).toEqual(['herido', 'herido en el puente']);
    dictation.stop();
    expect(dictation.listening).toBe(false);
  });

  it('ignores what a cancelled recognizer still reports', () => {
    const dictation = new Dictation(Fake);
    const texts: string[] = [];
    dictation.start('es', '', (text) => texts.push(text));
    const recognizer = FakeRecognizer.last;
    dictation.cancel();
    recognizer?.hear('demasiado tarde');
    expect(texts).toEqual([]);
  });

  it('says why it stopped, in terms the user can act on', () => {
    const dictation = new Dictation(Fake);
    dictation.start('es', '', () => undefined);
    FakeRecognizer.last?.fail('network');
    expect(dictation.problem).toBe('network');
    expect(dictation.listening).toBe(false);
  });
});
