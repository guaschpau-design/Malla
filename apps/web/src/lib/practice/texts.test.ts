// What the simulated members say must fit one radio message (protocol §3.5), as a real one would:
// every text of the practice, with its blanks filled at their longest likely, in each language.

import { CHAT_MAX_BYTES, utf8ByteLength } from '@tesel/protocol';
import { describe, expect, it } from 'vitest';

import { locales } from '../i18n/index.ts';

/** The longest each blank is likely to be: long street names, the whole team, a long task. */
const LONGEST: Readonly<Record<string, string>> = {
  where: 'a 650 m al noroeste de «Punto de encuentro»',
  street: 'la Avenida del Doctor Fleming',
  place: 'el Parque de la Ciudadela',
  streets: 'en la Avenida del Doctor Fleming, en la Calle Mayor y en la Calle Nueva',
  river: 'el Barranco del Carraixet',
  name: 'Carmen',
  user: 'María José',
  names: 'Carmen, Jordi, Luis, Marta, Nuria, Pablo y Sara',
  task: 'Sacar a la familia del n.º 47, en la Avenida del Doctor Fleming',
  direction: 'noroeste',
};

describe('the practice’s texts', () => {
  for (const [locale, messages] of Object.entries(locales)) {
    it(`fit a radio message in ${locale}`, () => {
      const long = Object.entries(messages).flatMap(([key, text]) => {
        if (!key.startsWith('practice') || typeof text !== 'string') return [];
        const filled = text.replace(/\{(\w+)\}/g, (_, blank: string) => LONGEST[blank] ?? '99');
        return utf8ByteLength(filled) > CHAT_MAX_BYTES ? [key] : [];
      });
      expect(long).toEqual([]);
    });
  }
});
