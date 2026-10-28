// A search area is marked cleared once every strip of its sweep is done, by the device that
// finished the last one (sweeps.ts), so that every device, older ones too, sees it cleared.

import { eventRefKey, ShapeStyleCode, type NodeId } from '@tesel/protocol';

import type { GroupFeed } from '../sync/group-feed.svelte.ts';
import { areasToClear } from './sweeps.ts';

export function useSweepCompletion(
  group: () => { readonly feed: GroupFeed; readonly self: NodeId } | null,
): void {
  /** Areas being marked, so a change meanwhile does not mark them twice. */
  // eslint-disable-next-line svelte/prefer-svelte-reactivity -- bookkeeping, never rendered
  const marking = new Set<string>();
  $effect(() => {
    const current = group();
    if (current === null) return;
    for (const area of areasToClear(current.feed.state, current.self)) {
      const key = eventRefKey(area.object);
      if (marking.has(key)) continue;
      marking.add(key);
      current.feed
        .restyleShape(area, ShapeStyleCode.SEARCH_CLEARED)
        .catch((error: unknown) => {
          console.warn('A swept area could not be marked cleared:', error);
        })
        .finally(() => marking.delete(key));
    }
  });
}
