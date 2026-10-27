import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { notices } from './notices.svelte.ts';
import { attempt, Submission } from './submission.svelte.ts';

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  for (const notice of notices.list) notices.withdraw(notice.id);
  vi.restoreAllMocks();
});

describe('submission', () => {
  it('is busy while sending and clear once it went through', async () => {
    const submission = new Submission();
    let finish: () => void = () => undefined;
    const sending = submission.run(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    expect(submission.busy).toBe(true);
    // A second tap while it goes sends nothing.
    expect(await submission.run(() => Promise.reject(new Error('twice')))).toBe(false);
    finish();
    expect(await sending).toBe(true);
    expect(submission.busy).toBe(false);
    expect(submission.failed).toBe(false);
  });

  it('says it failed, and forgets the failure on the next try', async () => {
    const submission = new Submission();
    expect(await submission.run(() => Promise.reject(new Error('sin red')))).toBe(false);
    expect(submission.failed).toBe(true);
    expect(submission.busy).toBe(false);
    expect(await submission.run(() => Promise.resolve())).toBe(true);
    expect(submission.failed).toBe(false);
  });

  it('tells the user when a button’s action fails', async () => {
    attempt(() => Promise.reject(new Error('disco lleno')), 'No se ha podido hacer.');
    await Promise.resolve();
    await Promise.resolve();
    expect(notices.list.map((notice) => notice.text)).toEqual(['No se ha podido hacer.']);
  });

  it('says nothing when it works', async () => {
    attempt(() => Promise.resolve(), 'No se ha podido hacer.');
    await Promise.resolve();
    await Promise.resolve();
    expect(notices.list).toEqual([]);
  });
});
