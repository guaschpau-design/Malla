// What the workspace's parts share: the active group as they see it, and the tools that take taps
// on the map.

import type { NodeId, Role } from '@tesel/protocol';

import type { PositionSharing } from '../position/position-sharing.svelte.ts';
import type { Situation } from '../practice/situations.ts';
import type { GroupFeed } from '../sync/group-feed.svelte.ts';

/**
 * The active group's feed and this device's place in it; for a practice, its other members are
 * simulated here.
 */
export interface WorkspaceGroup {
  readonly feed: GroupFeed;
  readonly self: NodeId;
  readonly role: Role;
  readonly sharing: PositionSharing;
  /** The situation a practice plays; null for a real group. */
  readonly practice: Situation | null;
}

/**
 * A tool in use on the map, which takes its taps: measuring, or planning the
 * sweep of a search area, by its key.
 */
export type MapTool =
  { readonly kind: 'measure' } | { readonly kind: 'sweep'; readonly area: string };
