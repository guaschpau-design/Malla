// Our own GeoJSON sources and layers on top of the base map. A new style (theme or language
// change) removes them, and the style may still be loading when they are first added, so they are
// installed again on every style change and whenever the map settles. Data and visibility set
// while they are not installed are kept and applied when they are.

import type { FeatureCollection } from 'geojson';
import type { GeoJSONSource, LayerSpecification, Map as MapLibreMap } from 'maplibre-gl';

const EMPTY: FeatureCollection = { type: 'FeatureCollection', features: [] };

export interface OverlaySpec<Source extends string> {
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

  /** The ids of the layers, for querying what was tapped. */
  get layerIds(): readonly string[] {
    return this.#layerIds;
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
    if (first === undefined || this.#map.getSource(first) !== undefined) return;
    this.#spec.prepare?.();
    for (const source of this.#spec.sources) {
      this.#map.addSource(source, { type: 'geojson', data: this.#data[source] });
    }
    const layers = this.#spec.layers();
    for (const layer of layers) {
      this.#map.addLayer({ ...layer, layout: { ...layer.layout, visibility: this.#visibility } });
    }
    this.#layerIds = layers.map((layer) => layer.id);
  }
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
    const overlay = new Overlay(map(), { ...use, sources });
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
