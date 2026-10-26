import { describe, expect, it } from 'vitest';

import {
  channelName,
  linkOf,
  networkName,
  networkStatus,
  radioLinkOf,
  type LinkInput,
} from './links.ts';

const BASE: LinkInput = {
  server: 'synced',
  viaCommandPost: false,
  radio: 'off',
  browserOnline: true,
};

describe('link', () => {
  it('works through the network when the group is synced with its server', () => {
    expect(linkOf(BASE)).toEqual({ channels: ['internet'], level: 'ok' });
    expect(linkOf({ ...BASE, viaCommandPost: true }).channels).toEqual(['command-post']);
  });

  it('lists both channels when the radio is linked too, and the radio alone without a server', () => {
    expect(linkOf({ ...BASE, radio: 'linked' }).channels).toEqual(['internet', 'radio']);
    expect(linkOf({ ...BASE, server: 'disconnected', radio: 'linked' })).toEqual({
      channels: ['radio'],
      level: 'ok',
    });
  });

  it('is connecting while the server or the radio is, and none when nothing works', () => {
    expect(linkOf({ ...BASE, server: 'syncing' }).level).toBe('connecting');
    expect(linkOf({ ...BASE, server: 'local-only', radio: 'connecting' }).level).toBe('connecting');
    expect(linkOf({ ...BASE, server: 'disconnected' })).toEqual({ channels: [], level: 'none' });
    expect(linkOf({ ...BASE, server: 'local-only' }).level).toBe('none');
  });

  it('falls back on the browser without a group', () => {
    expect(linkOf({ ...BASE, server: null }).level).toBe('ok');
    expect(linkOf({ ...BASE, server: null, browserOnline: false }).level).toBe('none');
  });
});

describe('channel names', () => {
  it('names the network by its medium where the browser tells it', () => {
    expect(networkName({ type: 'wifi', effectiveType: '4g' })).toBe('WiFi');
    expect(networkName({ type: 'cellular', effectiveType: '4g' })).toBe('4G/5G');
    expect(networkName({ type: 'cellular', effectiveType: '3g' })).toBe('3G');
    expect(networkName({ type: 'cellular', effectiveType: 'slow-2g' })).toBe('2G');
  });

  it('says WiFi/5G where the browser does not tell', () => {
    expect(networkName({ type: undefined, effectiveType: '4g' })).toBe('WiFi/5G');
  });

  it('calls a command post WiFi and the radio LoRa', () => {
    const network = { type: 'cellular', effectiveType: '4g' };
    expect(channelName('command-post', network)).toBe('WiFi');
    expect(channelName('radio', network)).toBe('LoRa');
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

describe('network status', () => {
  it('says in a few words how the network channel is doing', () => {
    expect(networkStatus(BASE)).toEqual({ level: 'ok', label: 'netServer' });
    expect(networkStatus({ ...BASE, viaCommandPost: true }).label).toBe('netCommandPost');
    expect(networkStatus({ ...BASE, server: 'syncing' }).level).toBe('connecting');
    expect(networkStatus({ ...BASE, server: 'local-only' }).label).toBe('netNoServer');
    expect(networkStatus({ ...BASE, server: null }).label).toBe('netNoGroup');
  });
});
