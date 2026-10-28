// One download of an area for offline use, as the interface follows it: its progress, why it
// stopped short if it did, and cancelling it. A download that stopped short can be resumed.

import {
  countAreaTiles,
  downloadArea,
  SourceUnreachable,
  type DownloadLayer,
} from '../map/area-download.ts';
import type { Bounds } from '../map/tile-math.ts';
import type { OfflineArea, TileStore } from '../map/tile-store.ts';
import { isStorageFull, keepStorage, roomForMaps } from '../storage/storage-space.svelte.ts';
import { estimatedBytes } from './offline-maps.ts';

export interface DownloadPlan {
  readonly name: string;
  readonly bounds: Bounds;
  readonly layers: readonly DownloadLayer[];
  /** The incomplete area this download resumes: it keeps its id and its date. */
  readonly resumes?: OfflineArea;
}

/** Why a download stopped short of the whole area. */
export type DownloadFailure =
  /** It did not start: it would leave too little room for the group's log (ADR-0056). */
  | { readonly kind: 'no-room'; readonly needed: number; readonly free: number }
  /** The storage filled up while downloading. */
  | { readonly kind: 'storage-full' }
  /** Tile after tile could not be had: no connection, or the service is down. */
  | { readonly kind: 'unreachable' }
  /** It went to the end, but some tiles never came. */
  | { readonly kind: 'incomplete' }
  | { readonly kind: 'failed' };

export class DownloadJob {
  /** Tiles done out of the total while downloading, or null. */
  progress: { readonly done: number; readonly total: number } | null = $state(null);
  /** Why the last download stopped short, or null if it did not (or was cancelled). */
  failure: DownloadFailure | null = $state.raw(null);
  #controller: AbortController | null = null;

  get running(): boolean {
    return this.progress !== null;
  }

  /**
   * Downloads `plan` into `store`, if there is room for it and for the group's log. Resolves to
   * true once the whole area is stored, false otherwise; it never rejects.
   */
  async run(store: TileStore, plan: DownloadPlan): Promise<boolean> {
    this.failure = null;
    const needed = estimatedBytes(plan.bounds, plan.layers);
    const room = await roomForMaps();
    if (room !== null && room < needed) {
      this.failure = { kind: 'no-room', needed, free: room };
      return false;
    }
    const controller = new AbortController();
    this.#controller = controller;
    this.progress = { done: 0, total: countAreaTiles(plan.bounds, plan.layers) };
    try {
      const area = await downloadArea(store, {
        id: plan.resumes?.id ?? crypto.randomUUID(),
        createdAt: plan.resumes?.createdAt ?? Date.now(),
        name: plan.name,
        bounds: plan.bounds,
        layers: plan.layers,
        signal: controller.signal,
        onProgress: ({ done, total }) => (this.progress = { done, total }),
      });
      await keepStorage();
      if (!area.complete) this.failure = { kind: 'incomplete' };
      return area.complete;
    } catch (error) {
      // Cancelled by the user: nothing to tell.
      if (!controller.signal.aborted) {
        console.warn('Offline area download stopped', error);
        this.failure = failureOf(error);
      }
      return false;
    } finally {
      this.progress = null;
      this.#controller = null;
    }
  }

  cancel(): void {
    this.#controller?.abort();
  }
}

function failureOf(error: unknown): DownloadFailure {
  if (isStorageFull(error)) return { kind: 'storage-full' };
  if (error instanceof SourceUnreachable) return { kind: 'unreachable' };
  return { kind: 'failed' };
}
