import { afterEach, describe, expect, it } from 'vitest';

import { closePanel, isOpen, openPanel, panels, togglePanel } from './panels.svelte.ts';

const AT = { lat: 39.47, lon: -0.37 };

afterEach(() => {
  closePanel();
});

describe('panels', () => {
  it('keeps one open at a time, with what it shows', () => {
    openPanel('chat');
    openPanel({ name: 'point', at: AT, title: 'Punto del mapa' });
    expect(isOpen('chat')).toBe(false);
    expect(panels.open).toEqual({ name: 'point', at: AT, title: 'Punto del mapa' });
  });

  it('closes the panel open when its button is pressed again, and opens another otherwise', () => {
    togglePanel('layers');
    expect(isOpen('layers')).toBe(true);
    togglePanel('layers');
    expect(panels.open).toBeNull();
    togglePanel('me');
    togglePanel('layers');
    expect(isOpen('layers')).toBe(true);
  });
});
