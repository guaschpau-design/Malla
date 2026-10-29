// What is new in the chat for this device: the chat lines and reports of others beyond as many as
// it has shown (GroupFeed.chatSeen). Counted, not dated, so that a line stamped by a clock that
// runs late is new all the same.

import type { GroupState } from '@tesel/core';
import type { NodeId } from '@tesel/protocol';

/** How many chat lines and reports the group holds from others than `self`. */
export function fromOthers(state: Pick<GroupState, 'chat' | 'reports'>, self: NodeId): number {
  const others = (event: { readonly origin: NodeId }) => event.origin !== self;
  return state.chat.filter(others).length + state.reports.filter(others).length;
}
