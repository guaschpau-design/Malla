// The contract between Teselia and a LoRa radio (ADR-0006). The app depends only on this; the
// MeshCore implementation is in meshcore-radio.ts.

export type RadioLinkState = 'disconnected' | 'connecting' | 'ready';

export interface ReceivedFrame {
  /** Encoded event bytes, exactly as the sender produced them. */
  readonly bytes: Uint8Array;
  /** Signal-to-noise ratio of the last hop, in dB. */
  readonly snr: number;
}

export type SendOutcome =
  { readonly status: 'sent' } | { readonly status: 'failed'; readonly reason: string };

export interface RadioLink {
  readonly state: RadioLinkState;
  /** Name the radio advertises over Bluetooth, once connected. */
  readonly name: string | null;

  /** Asks the user to pick a radio and connects to it. */
  connect(): Promise<void>;

  /**
   * Stores the group secret in a channel slot so the radio encrypts and decrypts our traffic.
   * Reuses a slot that already holds the secret; never overwrites another channel.
   */
  configureGroupChannel(groupName: string, secret: Uint8Array): Promise<void>;

  /** Floods one encoded event on the group channel. */
  send(bytes: Uint8Array): Promise<SendOutcome>;

  /** Subscribes to events received on the group channel; returns an unsubscribe function. */
  onReceive(listener: (frame: ReceivedFrame) => void): () => void;

  /** Subscribes to state changes; returns an unsubscribe function. */
  onStateChange(listener: (state: RadioLinkState) => void): () => void;

  disconnect(): Promise<void>;
}
