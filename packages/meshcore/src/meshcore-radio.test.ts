import { MESHCORE_DATA_TYPE } from '@tesel/protocol';
import { describe, expect, it, vi } from 'vitest';

import { channelName, chooseChannelSlot } from './channel-slot.ts';
import {
  PUSH_MSG_WAITING,
  type ChannelInfo,
  type CompanionConnection,
  type SyncedMessage,
} from './companion.ts';
import { MeshCoreRadio, RadioError } from './meshcore-radio.ts';
import type { ReceivedFrame } from './radio-link.ts';

const SECRET = new Uint8Array(16).fill(9);
const EMPTY = new Uint8Array(16);

/** A radio in memory: channel slots, a message queue and a log of what was sent. */
class FakeCompanion implements CompanionConnection {
  readonly listeners = new Map<string | number, Set<(...args: unknown[]) => void>>();
  readonly sent: { channel: number; pathLen: number; dataType: number; payload: Uint8Array }[] = [];
  readonly waiting: SyncedMessage[] = [];
  closed = false;

  channels: ChannelInfo[];

  constructor(channels: ChannelInfo[]) {
    this.channels = channels;
  }

  on(event: string | number, listener: (...args: unknown[]) => void): void {
    const set = this.listeners.get(event) ?? new Set();
    set.add(listener);
    this.listeners.set(event, set);
  }

  off(event: string | number, listener: (...args: unknown[]) => void): void {
    this.listeners.get(event)?.delete(listener);
  }

  emit(event: string | number): void {
    for (const listener of this.listeners.get(event) ?? []) listener();
  }

  getChannel(index: number): Promise<ChannelInfo> {
    const channel = this.channels[index];
    // meshcore.js rejects with no reason when the radio answers ERR; the fake does the same.
    // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
    return channel ? Promise.resolve(channel) : Promise.reject();
  }

  setChannel(index: number, name: string, secret: Uint8Array): Promise<void> {
    this.channels[index] = { channelIdx: index, name, secret };
    return Promise.resolve();
  }

  sendChannelData(
    channel: number,
    pathLen: number,
    _path: Uint8Array,
    dataType: number,
    payload: Uint8Array,
  ): Promise<unknown> {
    this.sent.push({ channel, pathLen, dataType, payload });
    return Promise.resolve({});
  }

  syncNextMessage(): Promise<SyncedMessage> {
    return Promise.resolve(this.waiting.shift() ?? null);
  }

  close(): Promise<void> {
    this.closed = true;
    return Promise.resolve();
  }
}

const slots = (...entries: [string, Uint8Array][]): ChannelInfo[] =>
  entries.map(([name, secret], channelIdx) => ({ channelIdx, name, secret }));

async function connected(fake: FakeCompanion): Promise<MeshCoreRadio> {
  const radio = new MeshCoreRadio(() =>
    Promise.resolve({ connection: fake, name: 'MeshCore-T1000' }),
  );
  await radio.connect();
  return radio;
}

describe('channel slots', () => {
  it('reuses the slot that already holds the group secret', () => {
    const channels = slots(['Public', EMPTY], ['', EMPTY], ['Rescate', SECRET]);
    expect(chooseChannelSlot(channels, SECRET)).toEqual({ kind: 'reuse', index: 2 });
  });

  it('takes the first empty slot, never the public one or someone else’s', () => {
    const channels = slots(['Public', EMPTY], ['Amigos', new Uint8Array(16).fill(1)], ['', EMPTY]);
    expect(chooseChannelSlot(channels, SECRET)).toEqual({ kind: 'empty', index: 2 });
    expect(chooseChannelSlot(channels.slice(0, 2), SECRET)).toEqual({ kind: 'full' });
  });

  it('cuts long group names to 31 bytes without splitting a character', () => {
    expect(channelName('Protección Civil de la Comunitat Valenciana')).toBe(
      'Protección Civil de la Comunit',
    );
    expect(new TextEncoder().encode(channelName('ñ'.repeat(20))).length).toBe(30);
  });
});

describe('MeshCore radio', () => {
  it('stores the group secret in a free slot and floods events with Tesel’s data type', async () => {
    const fake = new FakeCompanion(slots(['Public', EMPTY], ['', EMPTY]));
    const radio = await connected(fake);
    expect(radio.state).toBe('ready');
    expect(radio.name).toBe('MeshCore-T1000');
    await radio.configureGroupChannel('Rescate Valencia', SECRET);
    expect(fake.channels[1]).toEqual({ channelIdx: 1, name: 'Rescate Valencia', secret: SECRET });

    const bytes = new Uint8Array([1, 2, 3]);
    expect(await radio.send(bytes)).toEqual({ status: 'sent' });
    expect(fake.sent).toEqual([
      { channel: 1, pathLen: 0xff, dataType: MESHCORE_DATA_TYPE, payload: bytes },
    ]);
  });

  it('refuses to take over a radio whose channel slots are all in use', async () => {
    const fake = new FakeCompanion(
      slots(['Public', EMPTY], ['Amigos', new Uint8Array(16).fill(1)]),
    );
    const radio = await connected(fake);
    await expect(radio.configureGroupChannel('Rescate', SECRET)).rejects.toBeInstanceOf(RadioError);
    expect(await radio.send(new Uint8Array([1]))).toMatchObject({ status: 'failed' });
  });

  it('passes on Tesel datagrams of the group channel only', async () => {
    const fake = new FakeCompanion(slots(['Public', EMPTY], ['Rescate', SECRET]));
    const radio = await connected(fake);
    const frames: ReceivedFrame[] = [];
    radio.onReceive((frame) => frames.push(frame));
    await radio.configureGroupChannel('Rescate', SECRET);

    const ours = new Uint8Array([7, 7]);
    fake.waiting.push(
      { channelMessage: { channelIdx: 0, senderTimestamp: 1, text: 'Marta: hola' } },
      {
        channelData: {
          channelIdx: 0,
          dataType: MESHCORE_DATA_TYPE,
          data: new Uint8Array([1]),
          snr: 5,
        },
      },
      { channelData: { channelIdx: 1, dataType: 0x1234, data: new Uint8Array([2]), snr: 5 } },
      { channelData: { channelIdx: 1, dataType: MESHCORE_DATA_TYPE, data: ours, snr: 6.25 } },
    );
    fake.emit(PUSH_MSG_WAITING);
    await vi.waitFor(() => {
      expect(frames).toEqual([{ bytes: ours, snr: 6.25 }]);
    });
    expect(fake.waiting).toEqual([]);
  });

  it('keeps the text messages of other MeshCore apps instead of losing them', async () => {
    const fake = new FakeCompanion(slots(['Public', EMPTY], ['Rescate', SECRET]));
    const radio = await connected(fake);
    const texts: unknown[] = [];
    radio.onText((text) => texts.push(text));
    await radio.configureGroupChannel('Rescate', SECRET);
    fake.waiting.push(
      {
        channelMessage: {
          channelIdx: 0,
          senderTimestamp: 100,
          text: 'Marta: ¿Alguien en Benimaclet?',
        },
      },
      {
        contactMessage: {
          pubKeyPrefix: new Uint8Array([0xab, 0xcd, 1, 2, 3, 4]),
          senderTimestamp: 101,
          text: 'Hola',
        },
      },
    );
    fake.emit(PUSH_MSG_WAITING);
    await vi.waitFor(() => {
      expect(texts).toEqual([
        {
          kind: 'channel',
          channel: 'Public',
          sender: 'Marta',
          text: '¿Alguien en Benimaclet?',
          time: 100,
        },
        { kind: 'direct', channel: null, sender: 'abcd01020304', text: 'Hola', time: 101 },
      ]);
    });
  });

  it('reports a lost Bluetooth link as disconnected', async () => {
    const fake = new FakeCompanion(slots(['Public', EMPTY]));
    const radio = await connected(fake);
    const states: string[] = [];
    radio.onStateChange((state) => states.push(state));
    fake.emit('disconnected');
    expect(radio.state).toBe('disconnected');
    expect(states).toEqual(['disconnected']);
  });

  it('gives up on a command the radio never answers, and on the radio itself', async () => {
    vi.useFakeTimers();
    const fake = new FakeCompanion(slots(['Public', EMPTY], ['', EMPTY]));
    fake.sendChannelData = () => new Promise(() => undefined);
    const radio = await connected(fake);
    await radio.configureGroupChannel('Rescate', SECRET);
    const outcome = radio.send(new Uint8Array([1]));
    await vi.advanceTimersByTimeAsync(5000);
    expect(await outcome).toMatchObject({ status: 'failed', reason: 'the radio did not answer' });
    // A late answer could be taken for the next command's: the link is dropped instead.
    await vi.advanceTimersByTimeAsync(0);
    expect(radio.state).toBe('disconnected');
    expect(fake.closed).toBe(true);
    vi.useRealTimers();
  });
});
