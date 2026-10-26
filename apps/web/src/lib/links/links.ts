// How this device reaches its group right now, in words anyone understands: which channels work
// (internet, a command post, the radio), or that it is still connecting, or that nothing works and
// what is written waits. The header shows it and the connections panel explains it.

import type { RadioLinkState } from '@tesel/meshcore';

import type { MessageKey } from '../i18n/index.ts';
import type { FeedStatus } from '../sync/group-feed.svelte.ts';

export type Channel = 'internet' | 'command-post' | 'radio';

export interface LinkInput {
  /** The active group's sync with its relay, or null without a group. */
  readonly server: FeedStatus | null;
  /** True when that relay is a command post rather than the group's server (protocol §8.3). */
  readonly viaCommandPost: boolean;
  readonly radio: 'off' | 'connecting' | 'linked';
  /** Whether the browser believes it is online; it only matters without a group. */
  readonly browserOnline: boolean;
}

export interface Link {
  /** The channels that work now, in this order: internet or command post, then radio. */
  readonly channels: readonly Channel[];
  readonly level: 'ok' | 'connecting' | 'none';
  readonly label: MessageKey;
}

const LABELS = {
  internet: 'linkInternet',
  'command-post': 'linkCommandPost',
  radio: 'linkRadio',
  'internet+radio': 'linkInternetAndRadio',
  'command-post+radio': 'linkCommandPostAndRadio',
} as const satisfies Readonly<Record<string, MessageKey>>;

export function linkOf(input: LinkInput): Link {
  const channels: Channel[] = [];
  const relayUp = input.server === null ? input.browserOnline : input.server === 'synced';
  if (relayUp) channels.push(input.viaCommandPost ? 'command-post' : 'internet');
  if (input.radio === 'linked') channels.push('radio');
  if (channels.length > 0) {
    return { channels, level: 'ok', label: LABELS[channels.join('+') as keyof typeof LABELS] };
  }
  const connecting =
    input.server === 'connecting' || input.server === 'syncing' || input.radio === 'connecting';
  return connecting
    ? { channels, level: 'connecting', label: 'linkConnecting' }
    : { channels, level: 'none', label: 'linkNone' };
}

/** What the radio contributes: off, on its way (pairing, or paired but not on the group yet), or linked. */
export function radioLinkOf(radio: {
  readonly state: RadioLinkState;
  readonly linked: boolean;
}): LinkInput['radio'] {
  if (radio.linked) return 'linked';
  return radio.state === 'disconnected' ? 'off' : 'connecting';
}

const SERVER_DETAILS: Readonly<Record<FeedStatus, MessageKey>> = {
  synced: 'syncSynced',
  connecting: 'syncConnecting',
  syncing: 'syncConnecting',
  disconnected: 'syncDisconnected',
  'local-only': 'syncLocalOnly',
};

/** What the group's internet link is doing, in a sentence for the connections panel. */
export function serverDetail(input: LinkInput): MessageKey {
  if (input.server === null) return 'internetNoGroup';
  return input.viaCommandPost && input.server === 'synced'
    ? 'syncViaCommandPost'
    : SERVER_DETAILS[input.server];
}
