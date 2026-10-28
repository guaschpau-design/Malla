// What the workspace's parts share: the active group as they see it, and the tools that take taps
// on the map.

import type { LatLon, NodeId, Role } from '@tesel/protocol';

import type { PositionSharing } from '../position/position-sharing.svelte.ts';
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
  readonly practice: boolean;
}

/**
 * A tool in use on the map, which takes its taps: measuring, from a point if any, or planning the
 * sweep of a search area, by its key.
 */
export type MapTool =
  | { readonly kind: 'measure'; readonly from: LatLon | null }
  | { readonly kind: 'sweep'; readonly area: string };
