// Chat lines, alerts and situation reports, merged in the order every device agrees on.

import { compareEvents, type GroupState } from '@tesel/core';
import { eventRefKey, type AlertEvent, type ChatEvent, type ReportEvent } from '@tesel/protocol';

export type TimelineEntry = { readonly key: string } & (
  | { readonly kind: 'chat'; readonly event: ChatEvent }
  | { readonly kind: 'alert'; readonly event: AlertEvent }
  | { readonly kind: 'report'; readonly event: ReportEvent }
);

export function timeline(state: GroupState): TimelineEntry[] {
  const entries: TimelineEntry[] = [
    ...state.chat.map((event) => ({ key: eventRefKey(event), kind: 'chat' as const, event })),
    ...state.alerts.map((event) => ({ key: eventRefKey(event), kind: 'alert' as const, event })),
    ...state.reports.map((event) => ({ key: eventRefKey(event), kind: 'report' as const, event })),
  ];
  return entries.sort((a, b) => compareEvents(a.event, b.event));
}
