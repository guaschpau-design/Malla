// How this device reaches its group right now, named by the medium it travels on — WiFi, mobile
// data, LoRa — rather than by the service: the header shows it and the connections panel details
// each channel.

import type { RadioLinkState } from '@tesel/meshcore';

import type { MessageKey } from '../i18n/index.ts';
import type { FeedStatus } from '../sync/group-feed.svelte.ts';

export type Channel = 'internet' | 'command-post' | 'radio';

/** What the browser says of its network (Network Information API); undefined where it does not. */
export interface Network {
  /** 'wifi', 'cellular', 'ethernet'… */
  readonly type: string | undefined;
  /** How fast it behaves: 'slow-2g', '2g', '3g' or '4g', the fastest it reports. */
  readonly effectiveType: string | undefined;
}

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
}

export function linkOf(input: LinkInput): Link {
  const channels: Channel[] = [];
  const relayUp = input.server === null ? input.browserOnline : input.server === 'synced';
  if (relayUp) channels.push(input.viaCommandPost ? 'command-post' : 'internet');
  if (input.radio === 'linked') channels.push('radio');
  if (channels.length > 0) return { channels, level: 'ok' };
  const connecting =
    input.server === 'connecting' || input.server === 'syncing' || input.radio === 'connecting';
  return { channels, level: connecting ? 'connecting' : 'none' };
}

/**
 * The medium of the internet channel. Browsers do not tell 4G from 5G, so the fastest mobile data is
 * "4G/5G"; where the browser says nothing (iPhone, computers) it is "WiFi/5G".
 */
export function networkName(network: Network): string {
  if (network.type === 'wifi') return 'WiFi';
  if (network.type === 'cellular') {
    if (network.effectiveType === '3g') return '3G';
    if (network.effectiveType === '2g' || network.effectiveType === 'slow-2g') return '2G';
    return '4G/5G';
  }
  return 'WiFi/5G';
}

/** The medium of each channel, as the header names it. A command post is a WiFi network. */
export function channelName(channel: Channel, network: Network): string {
  switch (channel) {
    case 'internet':
      return networkName(network);
    case 'command-post':
      return 'WiFi';
    case 'radio':
      return 'LoRa';
  }
}

/** What the radio contributes: off, on its way (pairing, or paired but not on the group yet), or linked. */
export function radioLinkOf(radio: {
  readonly state: RadioLinkState;
  readonly linked: boolean;
}): LinkInput['radio'] {
  if (radio.linked) return 'linked';
  return radio.state === 'disconnected' ? 'off' : 'connecting';
}

/** The state of the network channel, in a few words for the connections panel. */
export function networkStatus(input: LinkInput): { level: Link['level']; label: MessageKey } {
  if (input.server === null) {
    return input.browserOnline
      ? { level: 'ok', label: 'netNoGroup' }
      : { level: 'none', label: 'netOffline' };
  }
  switch (input.server) {
    case 'synced':
      return input.viaCommandPost
        ? { level: 'ok', label: 'netCommandPost' }
        : { level: 'ok', label: 'netServer' };
    case 'connecting':
    case 'syncing':
      return { level: 'connecting', label: 'linkConnecting' };
    case 'disconnected':
      return { level: 'none', label: 'netOffline' };
    case 'local-only':
      return { level: 'none', label: 'netNoServer' };
  }
}
