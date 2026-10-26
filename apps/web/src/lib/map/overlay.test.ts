import type { Map as MapLibreMap } from 'maplibre-gl';
import { describe, expect, it } from 'vitest';

import { Overlay } from './overlay.svelte.ts';

/** Just enough of a map: sources, layers and events, fired at once like MapLibre does. */
class FakeMap {
  readonly sources = new Map<string, unknown>();
  readonly layers = new Map<string, { layout?: Record<string, unknown> }>();
  readonly #handlers = new Map<string, Set<() => void>>();

  on(type: string, handler: () => void): void {
    const set = this.#handlers.get(type) ?? new Set();
    set.add(handler);
    this.#handlers.set(type, set);
  }

  off(type: string, handler: () => void): void {
    this.#handlers.get(type)?.delete(handler);
  }

  fire(type: string): void {
    for (const handler of this.#handlers.get(type) ?? []) handler();
  }

  isStyleLoaded(): boolean {
    return true;
  }

  getSource(id: string): unknown {
    return this.sources.get(id);
  }

  addSource(id: string, source: unknown): void {
    if (this.sources.has(id)) throw new Error(`Source "${id}" already exists.`);
    this.sources.set(id, source);
    this.fire('styledata');
  }

  removeSource(id: string): void {
    this.sources.delete(id);
  }

  getLayer(id: string): unknown {
    return this.layers.get(id);
  }

  addLayer(layer: { id: string; layout?: Record<string, unknown> }): void {
    this.layers.set(layer.id, layer);
  }

  removeLayer(id: string): void {
    this.layers.delete(id);
  }

  setLayoutProperty(id: string, name: string, value: unknown): void {
    const layer = this.layers.get(id);
    if (layer) layer.layout = { ...layer.layout, [name]: value };
  }
}

const spec = (map: FakeMap) => ({
  sources: ['a', 'b'] as const,
  // Adding an image announces a style change straight away.
  prepare: () => {
    map.fire('styledata');
  },
  layers: () => [{ id: 'a-dots', type: 'circle' as const, source: 'a' }],
});

describe('map overlays', () => {
  it('installs once even when the map calls back while it is installing', () => {
    const map = new FakeMap();
    new Overlay(map as unknown as MapLibreMap, spec(map));
    expect([...map.sources.keys()]).toEqual(['a', 'b']);
    expect([...map.layers.keys()]).toEqual(['a-dots']);
  });

  it('comes back after a new style removes it, hidden if it was hidden', () => {
    const map = new FakeMap();
    const overlay = new Overlay(map as unknown as MapLibreMap, spec(map));
    overlay.setVisible(false);
    map.sources.clear();
    map.layers.clear();
    map.fire('styledata');
    expect(map.layers.get('a-dots')?.layout).toEqual({ visibility: 'none' });
  });

  it('takes everything away when removed', () => {
    const map = new FakeMap();
    new Overlay(map as unknown as MapLibreMap, spec(map)).remove();
    expect(map.sources.size + map.layers.size).toBe(0);
    map.fire('idle');
    expect(map.sources.size).toBe(0);
  });
});
