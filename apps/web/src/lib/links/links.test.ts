import { describe, expect, it } from 'vitest';

import { linkOf, radioLinkOf, serverDetail, type LinkInput } from './links.ts';

const BASE: LinkInput = {
  server: 'synced',
  viaCommandPost: false,
  radio: 'off',
  browserOnline: true,
};

describe('link', () => {
  it('says internet when the group is synced with its server', () => {
    expect(linkOf(BASE)).toEqual({ channels: ['internet'], level: 'ok', label: 'linkInternet' });
  });

  it('says command post when the relay is one', () => {
    expect(linkOf({ ...BASE, viaCommandPost: true }).label).toBe('linkCommandPost');
  });

  it('names both channels when the radio is linked too', () => {
    expect(linkOf({ ...BASE, radio: 'linked' })).toMatchObject({
      channels: ['internet', 'radio'],
      label: 'linkInternetAndRadio',
    });
    expect(linkOf({ ...BASE, viaCommandPost: true, radio: 'linked' }).label).toBe(
      'linkCommandPostAndRadio',
    );
  });

  it('says radio alone when the server cannot be reached', () => {
    expect(linkOf({ ...BASE, server: 'disconnected', radio: 'linked' })).toMatchObject({
      channels: ['radio'],
      level: 'ok',
      label: 'linkRadio',
    });
  });

  it('says it is connecting while the server or the radio is', () => {
    expect(linkOf({ ...BASE, server: 'syncing' }).level).toBe('connecting');
    expect(linkOf({ ...BASE, server: 'local-only', radio: 'connecting' }).label).toBe(
      'linkConnecting',
    );
  });

  it('says there is no connection when nothing works', () => {
    expect(linkOf({ ...BASE, server: 'disconnected' })).toEqual({
      channels: [],
      level: 'none',
      label: 'linkNone',
    });
    expect(linkOf({ ...BASE, server: 'local-only' }).level).toBe('none');
  });

  it('falls back on the browser without a group', () => {
    expect(linkOf({ ...BASE, server: null }).label).toBe('linkInternet');
    expect(linkOf({ ...BASE, server: null, browserOnline: false }).label).toBe('linkNone');
  });
});

describe('radio link', () => {
  it('counts a radio as linked only once it is on the group, and as coming while it pairs', () => {
    expect(radioLinkOf({ state: 'disconnected', linked: false })).toBe('off');
    expect(radioLinkOf({ state: 'connecting', linked: false })).toBe('connecting');
    expect(radioLinkOf({ state: 'ready', linked: false })).toBe('connecting');
    expect(radioLinkOf({ state: 'ready', linked: true })).toBe('linked');
  });
});

describe('server detail', () => {
  it('describes the internet link in a sentence', () => {
    expect(serverDetail(BASE)).toBe('syncSynced');
    expect(serverDetail({ ...BASE, viaCommandPost: true })).toBe('syncViaCommandPost');
    expect(serverDetail({ ...BASE, server: 'syncing' })).toBe('syncConnecting');
    expect(serverDetail({ ...BASE, server: null })).toBe('internetNoGroup');
  });
});
