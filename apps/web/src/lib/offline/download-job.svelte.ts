// One download of an area for offline use, as the interface follows it: its progress, whether it
// failed, and cancelling it.

import { countAreaTiles, downloadArea, type DownloadLayer } from '../map/area-download.ts';
import type { Bounds } from '../map/tile-math.ts';
import type { TileStore } from '../map/tile-store.ts';

export interface DownloadPlan {
  readonly name: string;
  readonly bounds: Bounds;
  readonly layers: readonly DownloadLayer[];
}

export class DownloadJob {
  /** Tiles done out of the total while downloading, or null. */
  progress: { readonly done: number; readonly total: number } | null = $state(null);
  failed = $state(false);
  #controller: AbortController | null = null;

  get running(): boolean {
    return this.progress !== null;
  }

  /**
   * Downloads `plan` into `store`. Resolves to true once the whole area is stored, false if the
   * download failed or was cancelled; it never rejects.
   */
  async run(store: TileStore, plan: DownloadPlan): Promise<boolean> {
    const controller = new AbortController();
    this.#controller = controller;
    this.failed = false;
    this.progress = { done: 0, total: countAreaTiles(plan.bounds, plan.layers) };
    try {
      await downloadArea(store, {
        id: crypto.randomUUID(),
        ...plan,
        signal: controller.signal,
        onProgress: ({ done, total }) => (this.progress = { done, total }),
      });
      // Ask the browser not to evict our data under storage pressure.
      await navigator.storage.persist();
      return true;
    } catch (error) {
      this.failed = !controller.signal.aborted;
      if (this.failed) console.warn('Offline area download failed', error);
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
