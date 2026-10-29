// The short notice that says something sent reached the group, is on its way by radio, or waits on
// the device: after a marker, a zone, a route, a task or a report, so nobody wonders whether it went.

import type { MessageKey, Translate } from '../i18n/index.ts';
import { notices } from '../ui/notices.svelte.ts';
import type { Delivery, GroupFeed } from './group-feed.svelte.ts';

const SENT: Readonly<Record<Delivery, MessageKey>> = {
  group: 'sentToGroup',
  radio: 'sentByRadio',
  waiting: 'sentWaiting',
};

export function noticeSent(t: Translate, feed: GroupFeed): void {
  notices.show(t(SENT[feed.delivery]));
}
