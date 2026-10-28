import { afterEach, describe, expect, it } from 'vitest';

import { confirmations } from './confirmations.svelte.ts';

afterEach(() => {
  confirmations.answer(false);
});

describe('confirmations', () => {
  it('shows a question until it is answered, and gives the answer', async () => {
    const asked = confirmations.ask({ text: '¿Salir de «Rescate»?', confirm: 'Salir' });
    expect(confirmations.current).toMatchObject({ text: '¿Salir de «Rescate»?', confirm: 'Salir' });
    confirmations.answer(true);
    expect(await asked).toBe(true);
    expect(confirmations.current).toBeNull();
  });

  it('answers a question no when another is asked', async () => {
    const first = confirmations.ask({ text: '¿Borrar «Foco»?', confirm: 'Borrar' });
    const second = confirmations.ask({ text: '¿Cancelar este SOS?', confirm: 'Cancelar SOS' });
    expect(await first).toBe(false);
    expect(confirmations.current?.text).toBe('¿Cancelar este SOS?');
    confirmations.answer(true);
    expect(await second).toBe(true);
  });
});
