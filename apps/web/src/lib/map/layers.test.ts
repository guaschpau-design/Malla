import { describe, expect, it } from 'vitest';

import { LAYER_SECTIONS, MAP_FLAGS, MAP_LAYERS } from './layers.ts';

describe('map layers', () => {
  it('puts every layer and flag in exactly one section of the panel', () => {
    const listed = LAYER_SECTIONS.flatMap((section) => section.switches);
    expect([...listed].sort()).toEqual([...MAP_LAYERS, ...MAP_FLAGS].sort());
  });
});
