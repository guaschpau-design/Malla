// The part of meshcore.js's companion connection that Tesel uses, typed. Keeping it small
// makes the library easy to replace and the radio easy to fake in tests.

export interface ChannelInfo {
  readonly channelIdx: number;
  readonly name: string;
  readonly secret: Uint8Array;
}

export interface ChannelData {
  readonly snr: number;
  readonly channelIdx: number;
  readonly dataType: number;
  readonly data: Uint8Array;
}

/** A text message of another MeshCore app, on a channel. The text starts with "Sender: ". */
export interface ChannelMessage {
  readonly channelIdx: number;
  readonly senderTimestamp: number;
  readonly text: string;
}

/** A private text message of another MeshCore app, to this radio. */
export interface ContactMessage {
  readonly pubKeyPrefix: Uint8Array;
  readonly senderTimestamp: number;
  readonly text: string;
}

export type SyncedMessage =
  | { readonly channelData: ChannelData }
  | { readonly channelMessage: ChannelMessage }
  | { readonly contactMessage: ContactMessage }
  | null;

export interface CompanionConnection {
  on(event: string | number, listener: (...args: unknown[]) => void): void;
  off(event: string | number, listener: (...args: unknown[]) => void): void;
  getChannel(channelIdx: number): Promise<ChannelInfo>;
  setChannel(channelIdx: number, name: string, secret: Uint8Array): Promise<void>;
  sendChannelData(
    channelIdx: number,
    pathLen: number,
    path: Uint8Array,
    dataType: number,
    payload: Uint8Array,
  ): Promise<unknown>;
  syncNextMessage(): Promise<SyncedMessage>;
  close(): Promise<void>;
}

/** Companion protocol codes used here (MeshCore companion_radio firmware). */
export const PUSH_MSG_WAITING = 0x83;
/** `path_len` value that makes the radio flood a packet instead of routing it. */
export const FLOOD = 0xff;
