import { encodeEvent, type NodeId, type TeseliaEvent } from '@teselia/protocol';
import type { RadioLink, RadioLinkState, ReceivedFrame, SendOutcome } from '@teselia/meshcore';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { LoraSink } from '../sync/group-feed.svelte.ts';
import { RadioSession, type RadioFeed } from './radio.svelte.ts';

class FakeLink implements RadioLink {
  state: RadioLinkState = 'disconnected';
  name: string | null = null;
  channel: string | null = null;
  readonly sent: Uint8Array[] = [];
  #receive: ((frame: ReceivedFrame) => void) | null = null;
  #stateChange: ((state: RadioLinkState) => void) | null = null;

  connect(): Promise<void> {
    this.state = 'ready';
    this.name = 'MeshCore-T1000';
    this.#stateChange?.('ready');
    return Promise.resolve();
  }

  configureGroupChannel(name: string): Promise<void> {
    this.channel = name;
    return Promise.resolve();
  }

  send(bytes: Uint8Array): Promise<SendOutcome> {
    this.sent.push(bytes);
    return Promise.resolve({ status: 'sent' });
  }

  onReceive(listener: (frame: ReceivedFrame) => void): () => void {
    this.#receive = listener;
    return () => undefined;
  }

  onStateChange(listener: (state: RadioLinkState) => void): () => void {
    this.#stateChange = listener;
    return () => undefined;
  }

  disconnect(): Promise<void> {
    this.state = 'disconnected';
    this.#stateChange?.('disconnected');
    return Promise.resolve();
  }

  hear(bytes: Uint8Array): void {
    this.#receive?.({ bytes, snr: 7.5 });
  }
}

class FakeFeed implements RadioFeed {
  sink: LoraSink | null = null;
  readonly received: Uint8Array[] = [];
  readonly radioChannel = { name: 'Rescate', secret: new Uint8Array(16).fill(1) };

  attachRadio(sink: LoraSink | null): void {
    this.sink = sink;
  }

  receiveFromRadio(bytes: Uint8Array): Promise<void> {
    this.received.push(bytes);
    return Promise.resolve();
  }
}

const chat: TeseliaEvent = {
  type: 'chat',
  origin: 'a1b2c3d4' as NodeId,
  seq: 1,
  time: 1,
  text: 'hola',
};
const encoded = encodeEvent(chat);
const bytes = encoded.ok ? encoded.value : new Uint8Array();

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('radio session', () => {
  it('configures the active group’s channel once connected and sends its events', async () => {
    const link = new FakeLink();
    const radio = new RadioSession(link, () => 0);
    const feed = new FakeFeed();
    await radio.useFeed(feed);
    expect(feed.sink).toBeNull();

    await radio.connect();
    expect(radio.state).toBe('ready');
    expect(radio.linked).toBe(true);
    expect(link.channel).toBe('Rescate');

    feed.sink?.offer({ event: chat, bytes }, 'own');
    await vi.advanceTimersByTimeAsync(1000);
    expect(link.sent).toEqual([bytes]);
  });

  it('hands what it hears to the feed', async () => {
    const link = new FakeLink();
    const radio = new RadioSession(link);
    const feed = new FakeFeed();
    await radio.connect();
    await radio.useFeed(feed);
    link.hear(bytes);
    expect(feed.received).toEqual([bytes]);
    expect(radio.lastSnr).toBe(7.5);
  });

  it('unlinks the feed when the radio goes away', async () => {
    const link = new FakeLink();
    const radio = new RadioSession(link);
    const feed = new FakeFeed();
    await radio.connect();
    await radio.useFeed(feed);
    await radio.disconnect();
    expect(radio.linked).toBe(false);
    expect(feed.sink).toBeNull();
  });
});
