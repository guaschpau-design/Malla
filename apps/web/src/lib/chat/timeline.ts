// Chat lines and alerts, merged in the order every device agrees on.

import { compareEvents, type GroupState } from '@teselia/core';
import { eventRefKey, type AlertEvent, type ChatEvent } from '@teselia/protocol';

export type TimelineEntry = { readonly key: string } & (
  | { readonly kind: 'chat'; readonly event: ChatEvent }
  | { readonly kind: 'alert'; readonly event: AlertEvent }
);

export function timeline(state: GroupState): TimelineEntry[] {
  const entries: TimelineEntry[] = [
    ...state.chat.map((event) => ({ key: eventRefKey(event), kind: 'chat' as const, event })),
    ...state.alerts.map((event) => ({ key: eventRefKey(event), kind: 'alert' as const, event })),
  ];
  return entries.sort((a, b) => compareEvents(a.event, b.event));
}
