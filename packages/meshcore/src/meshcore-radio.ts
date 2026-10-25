// RadioLink over a MeshCore companion radio (protocol §7, ADR-0006).
//
// The companion protocol answers commands with generic OK/ERR frames, so two commands in flight
// at once could take each other's answers. Every command therefore goes through one queue, and
// each has a timeout in case the radio never answers (old firmware, lost Bluetooth link).

import { channelName, chooseChannelSlot } from './channel-slot.ts';
import {
  FLOOD,
  PUSH_MSG_WAITING,
  type ChannelInfo,
  type CompanionConnection,
} from './companion.ts';
import { ACCEPTED_DATA_TYPES, SEND_DATA_TYPE } from './data-type.ts';
import type { RadioLink, RadioLinkState, ReceivedFrame, SendOutcome } from './radio-link.ts';

/** Opens a connection; for Web Bluetooth this asks the user to pick a radio. */
export type Connector = () => Promise<{ connection: CompanionConnection; name: string | null }>;

const COMMAND_TIMEOUT_MS = 5000;
/** MeshCore companion firmware has at most this many channel slots. */
const MAX_CHANNELS = 40;

export class RadioError extends Error {
  readonly code: 'no-free-channel' | 'not-ready' | 'timeout' | 'refused';

  constructor(code: RadioError['code'], message: string) {
    super(message);
    this.code = code;
  }
}

export class MeshCoreRadio implements RadioLink {
  readonly #connector: Connector;
  #connection: CompanionConnection | null = null;
  #state: RadioLinkState = 'disconnected';
  #name: string | null = null;
  #channel: number | null = null;
  #queue: Promise<unknown> = Promise.resolve();
  #draining = false;
  #drainRequested = false;
  readonly #receivers = new Set<(frame: ReceivedFrame) => void>();
  readonly #stateListeners = new Set<(state: RadioLinkState) => void>();
  readonly #onMessageWaiting = () => void this.#drain();
  readonly #onDisconnected = () => {
    this.#reset();
  };

  constructor(connector: Connector) {
    this.#connector = connector;
  }

  get state(): RadioLinkState {
    return this.#state;
  }

  get name(): string | null {
    return this.#name;
  }

  async connect(): Promise<void> {
    if (this.#state !== 'disconnected') return;
    this.#setState('connecting');
    try {
      const { connection, name } = await this.#connector();
      this.#connection = connection;
      this.#name = name;
      connection.on(PUSH_MSG_WAITING, this.#onMessageWaiting);
      connection.on('disconnected', this.#onDisconnected);
      this.#setState('ready');
    } catch (error) {
      this.#reset();
      throw error;
    }
  }

  async configureGroupChannel(groupName: string, secret: Uint8Array): Promise<void> {
    const connection = this.#ready();
    const channels = await this.#listChannels(connection);
    const choice = chooseChannelSlot(channels, secret);
    if (choice.kind === 'full') {
      throw new RadioError('no-free-channel', 'every channel slot of the radio is in use');
    }
    if (choice.kind === 'empty') {
      await this.#command(() =>
        connection.setChannel(choice.index, channelName(groupName), secret),
      );
    }
    this.#channel = choice.index;
    // Pick up anything that arrived for the group before we were listening.
    void this.#drain();
  }

  async send(bytes: Uint8Array): Promise<SendOutcome> {
    const connection = this.#connection;
    const channel = this.#channel;
    if (connection === null || channel === null) {
      return { status: 'failed', reason: 'radio not ready' };
    }
    try {
      await this.#command(() =>
        connection.sendChannelData(channel, FLOOD, new Uint8Array(0), SEND_DATA_TYPE, bytes),
      );
      return { status: 'sent' };
    } catch (error) {
      return { status: 'failed', reason: error instanceof Error ? error.message : 'refused' };
    }
  }

  onReceive(listener: (frame: ReceivedFrame) => void): () => void {
    this.#receivers.add(listener);
    return () => this.#receivers.delete(listener);
  }

  onStateChange(listener: (state: RadioLinkState) => void): () => void {
    this.#stateListeners.add(listener);
    return () => this.#stateListeners.delete(listener);
  }

  async disconnect(): Promise<void> {
    const connection = this.#connection;
    this.#reset();
    await connection?.close();
  }

  /** Reads channel slots until the radio says there are no more. */
  async #listChannels(connection: CompanionConnection): Promise<ChannelInfo[]> {
    const channels: ChannelInfo[] = [];
    for (let index = 0; index < MAX_CHANNELS; index++) {
      try {
        channels.push(await this.#command(() => connection.getChannel(index)));
      } catch (error) {
        if (error instanceof RadioError && error.code === 'timeout') throw error;
        break; // An error answer marks the end of the slots.
      }
    }
    return channels;
  }

  /**
   * Fetches every message the radio is holding and passes ours on. A notice that arrives while
   * draining makes the loop run once more, so no message is left waiting.
   */
  async #drain(): Promise<void> {
    this.#drainRequested = true;
    if (this.#draining) return;
    this.#draining = true;
    try {
      while (this.#drainRequested) {
        this.#drainRequested = false;
        await this.#drainOnce();
      }
    } catch (error) {
      console.warn('Reading from the radio failed', error);
    } finally {
      this.#draining = false;
    }
  }

  async #drainOnce(): Promise<void> {
    const connection = this.#connection;
    if (connection === null) return;
    for (;;) {
      const message = await this.#command(() => connection.syncNextMessage());
      if (message === null) return;
      if (!('channelData' in message)) continue; // Text messages for other MeshCore apps.
      const { channelIdx, dataType, data, snr } = message.channelData;
      if (channelIdx !== this.#channel || !ACCEPTED_DATA_TYPES.includes(dataType)) continue;
      for (const receiver of this.#receivers) receiver({ bytes: data, snr });
    }
  }

  /** Runs one command after the previous one has finished, with a timeout. */
  #command<T>(run: () => Promise<T>): Promise<T> {
    const result = this.#queue.then(() => withTimeout(run()));
    this.#queue = result.catch(() => undefined);
    return result;
  }

  #ready(): CompanionConnection {
    if (this.#connection === null || this.#state !== 'ready') {
      throw new RadioError('not-ready', 'the radio is not connected');
    }
    return this.#connection;
  }

  #reset(): void {
    this.#connection?.off(PUSH_MSG_WAITING, this.#onMessageWaiting);
    this.#connection?.off('disconnected', this.#onDisconnected);
    this.#connection = null;
    this.#channel = null;
    this.#name = null;
    this.#setState('disconnected');
  }

  #setState(state: RadioLinkState): void {
    if (state === this.#state) return;
    this.#state = state;
    for (const listener of this.#stateListeners) listener(state);
  }
}

async function withTimeout<T>(promise: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new RadioError('timeout', 'the radio did not answer'));
    }, COMMAND_TIMEOUT_MS);
  });
  try {
    return await Promise.race([promise.catch(rethrowAsRefused), timeout]);
  } finally {
    clearTimeout(timer);
  }
}

/** meshcore.js rejects with no value when the radio answers ERR. */
function rethrowAsRefused(error: unknown): never {
  if (error instanceof Error) throw error;
  throw new RadioError('refused', 'the radio refused the command');
}
