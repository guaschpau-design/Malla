// Chat lines and situation reports, merged in the order every device agrees on.

import { compareEvents, type GroupState } from '@tesel/core';
import { eventRefKey, type ChatEvent, type ReportEvent } from '@tesel/protocol';

export type TimelineEntry = { readonly key: string } & (
  | {
      readonly kind: 'chat';
      readonly event: ChatEvent;
      /** Follows a line of the same person's, shortly before: shown without their name. */
      readonly follows: boolean;
    }
  | { readonly kind: 'report'; readonly event: ReportEvent }
);

/** Lines of one person this close to each other read as one run, under one name. */
export const RUN_GAP_SECONDS = 5 * 60;

export function timeline(state: GroupState): TimelineEntry[] {
  const events: (ChatEvent | ReportEvent)[] = [...state.chat, ...state.reports].sort(compareEvents);
  return events.map((event, index): TimelineEntry => {
    const key = eventRefKey(event);
    switch (event.type) {
      case 'chat': {
        const before = events[index - 1];
        const follows =
          before?.type === 'chat' &&
          before.origin === event.origin &&
          event.time - before.time <= RUN_GAP_SECONDS;
        return { key, kind: 'chat', event, follows };
      }
      case 'report':
        return { key, kind: 'report', event };
    }
  });
}
