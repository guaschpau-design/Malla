import type { Map as MapLibreMap } from 'maplibre-gl';
import { describe, expect, it } from 'vitest';

import { Overlay } from './overlay.svelte.ts';

interface Layer {
  id: string;
  layout?: Record<string, unknown>;
  metadata?: unknown;
}

/** Just enough of a map: sources, layers and events, fired at once like MapLibre does. */
class FakeMap {
  readonly sources = new Map<string, unknown>();
  /** In drawing order, bottom first. */
  readonly layers = new Map<string, Layer>();
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

  addLayer(layer: Layer, before?: string): void {
    const ordered = [...this.layers.values()];
    const at = before === undefined ? ordered.length : ordered.findIndex((l) => l.id === before);
    ordered.splice(at, 0, layer);
    this.layers.clear();
    for (const item of ordered) this.layers.set(item.id, item);
  }

  getStyle(): { layers: Layer[] } {
    return { layers: [...this.layers.values()] };
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
  level: 'members' as const,
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

  it('stacks overlays by level, whatever order they come in', () => {
    const map = new FakeMap();
    const overlay = (level: 'trails' | 'self', id: string) =>
      new Overlay(map as unknown as MapLibreMap, {
        level,
        sources: [id],
        layers: () => [{ id: `${id}-line`, type: 'line' as const, source: id }],
      });
    overlay('self', 'me');
    overlay('trails', 'trails');
    expect([...map.layers.keys()]).toEqual(['trails-line', 'me-line']);
  });

  it('takes everything away when removed', () => {
    const map = new FakeMap();
    new Overlay(map as unknown as MapLibreMap, spec(map)).remove();
    expect(map.sources.size + map.layers.size).toBe(0);
    map.fire('idle');
    expect(map.sources.size).toBe(0);
  });
});
