// Drawing a map object: tapping its points (`draft`), or reading a route from a file, then
// describing it (`describing`) before it is shared with the group.

import type { LatLon } from '@tesel/protocol';

import { addPoint, isFull, startDraft, undoPoint, type Draft, type DraftKind } from './draft.ts';
import type { ImportedRoute } from './route-import.ts';

export class Drawing {
  draft: Draft | null = $state.raw(null);
  describing = $state(false);
  /** The route read from a file, when the draft came from one. */
  imported: ImportedRoute | null = $state.raw(null);

  /** Placing its points on the map, before describing. */
  get placingPoints(): boolean {
    return this.draft !== null && !this.describing;
  }

  start(kind: DraftKind): void {
    this.draft = startDraft(kind);
    this.describing = false;
    this.imported = null;
  }

  /** Takes a route read from a file as the draft, to be looked over on the map and finished. */
  load(route: ImportedRoute): void {
    this.draft = { kind: 'route', points: route.points };
    this.describing = false;
    this.imported = route;
  }

  /** Adds a tapped point; once no more fit, the object is ready to be described. */
  add(at: LatLon): void {
    if (this.draft === null) return;
    this.draft = addPoint(this.draft, at);
    if (isFull(this.draft)) this.describing = true;
  }

  undo(): void {
    if (this.draft !== null) this.draft = undoPoint(this.draft);
  }

  finish(): void {
    this.describing = true;
  }

  stop(): void {
    this.draft = null;
    this.describing = false;
    this.imported = null;
  }
}
