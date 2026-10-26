// Our own GeoJSON sources and layers on top of the base map. A new style (theme or language
// change) removes them, and the style may still be loading when they are first added, so they are
// installed again on every style change and whenever the map settles. Data and visibility set
// while they are not installed are kept and applied when they are. Each overlay has a level, so
// the stacking is the same whatever order they were installed in.

import type { FeatureCollection } from 'geojson';
import type { GeoJSONSource, LayerSpecification, Map as MapLibreMap } from 'maplibre-gl';
import { untrack } from 'svelte';

const EMPTY: FeatureCollection = { type: 'FeatureCollection', features: [] };

/** Our overlays from bottom to top: each is drawn above every one listed before it. */
export const OVERLAY_LEVELS = [
  'trails',
  'objects',
  'tasks',
  'members',
  'sos',
  'self',
  'navigation',
  'point',
  'draft',
] as const;
export type OverlayLevel = (typeof OVERLAY_LEVELS)[number];

/** Where a layer records its overlay's level, in MapLibre's free-form layer metadata. */
const LEVEL_KEY = 'tesel:level';

export interface OverlaySpec<Source extends string> {
  readonly level: OverlayLevel;
  /** The names of the sources, unique on the map. Each starts empty until `setData`. */
  readonly sources: readonly Source[];
  /**
   * The layers, bottom to top. Built on each install, so they take the colours of the current
   * theme (ui/theme.ts).
   */
  readonly layers: () => LayerSpecification[];
  /** Runs before each install, for what the layers need first, such as their images. */
  readonly prepare?: () => void;
}

export class Overlay<Source extends string> {
  readonly #map: MapLibreMap;
  readonly #spec: OverlaySpec<Source>;
  readonly #data: Record<Source, FeatureCollection>;
  #layerIds: readonly string[] = [];
  #visible = true;
  /**
   * Adding images or sources makes the map announce a style change at once, which calls
   * `#install` again before the first call is done.
   */
  #installing = false;
  readonly #install = () => {
    this.#installNow();
  };

  constructor(map: MapLibreMap, spec: OverlaySpec<Source>) {
    this.#map = map;
    this.#spec = spec;
    this.#data = Object.fromEntries(spec.sources.map((source) => [source, EMPTY])) as Record<
      Source,
      FeatureCollection
    >;
    map.on('styledata', this.#install);
    map.on('idle', this.#install);
    if (map.isStyleLoaded()) this.#installNow();
  }

  setData(source: Source, data: FeatureCollection): void {
    this.#data[source] = data;
    void this.#map.getSource<GeoJSONSource>(source)?.setData(data);
  }

  setVisible(visible: boolean): void {
    this.#visible = visible;
    for (const id of this.#layerIds) {
      if (this.#map.getLayer(id)) this.#map.setLayoutProperty(id, 'visibility', this.#visibility);
    }
  }

  remove(): void {
    this.#map.off('styledata', this.#install);
    this.#map.off('idle', this.#install);
    for (const id of [...this.#layerIds].reverse()) {
      if (this.#map.getLayer(id)) this.#map.removeLayer(id);
    }
    for (const source of this.#spec.sources) {
      if (this.#map.getSource(source)) this.#map.removeSource(source);
    }
  }

  get #visibility(): 'visible' | 'none' {
    return this.#visible ? 'visible' : 'none';
  }

  #installNow(): void {
    const [first] = this.#spec.sources;
    if (this.#installing || first === undefined || this.#map.getSource(first) !== undefined) {
      return;
    }
    this.#installing = true;
    try {
      this.#addEverything();
    } finally {
      this.#installing = false;
    }
  }

  #addEverything(): void {
    this.#spec.prepare?.();
    for (const source of this.#spec.sources) {
      this.#map.addSource(source, { type: 'geojson', data: this.#data[source] });
    }
    const level = OVERLAY_LEVELS.indexOf(this.#spec.level);
    // Below the first layer of a higher overlay already on the map, if any.
    const before = this.#map.getStyle().layers.find((layer) => levelOf(layer) > level)?.id;
    const layers = this.#spec.layers();
    for (const layer of layers) {
      this.#map.addLayer(
        {
          ...layer,
          layout: { ...layer.layout, visibility: this.#visibility },
          metadata: { [LEVEL_KEY]: level },
        },
        before,
      );
    }
    this.#layerIds = layers.map((layer) => layer.id);
  }
}

/** The overlay level of a layer of the map; base map layers have none. */
function levelOf(layer: LayerSpecification): number {
  const metadata = layer.metadata as Record<string, unknown> | undefined;
  const level = metadata?.[LEVEL_KEY];
  return typeof level === 'number' ? level : -1;
}

export interface OverlayUse<Source extends string> extends Omit<OverlaySpec<Source>, 'sources'> {
  /** Each source's data, read reactively: the map updates when it changes. */
  readonly data: Readonly<Record<Source, () => FeatureCollection>>;
  /** Whether the layers are shown, read reactively. Shown when omitted. */
  readonly visible?: () => boolean;
}

/**
 * Puts an overlay on the map for as long as the calling component lives, keeping its data and
 * visibility in step with what they are read from. Call it while the component initialises.
 */
export function useOverlay<Source extends string>(
  map: () => MapLibreMap,
  use: OverlayUse<Source>,
): void {
  $effect(() => {
    const sources = Object.keys(use.data) as Source[];
    const target = map();
    // Building the overlay reads the layers' colours; nothing in it should rerun this effect.
    const overlay = untrack(() => new Overlay(target, { ...use, sources }));
    $effect(() => {
      for (const source of sources) overlay.setData(source, use.data[source]());
    });
    $effect(() => {
      overlay.setVisible(use.visible?.() ?? true);
    });
    return () => {
      overlay.remove();
    };
  });
}
