// Drawing a map object: tapping its points (`draft`), then describing it (`describing`) before it
// is shared with the group.

import type { LatLon } from '@tesel/protocol';

import { addPoint, isFull, startDraft, undoPoint, type Draft, type DraftKind } from './draft.ts';

export class Drawing {
  draft: Draft | null = $state.raw(null);
  describing = $state(false);

  /** Placing its points on the map, before describing. */
  get placingPoints(): boolean {
    return this.draft !== null && !this.describing;
  }

  start(kind: DraftKind): void {
    this.draft = startDraft(kind);
    this.describing = false;
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
  }
}
