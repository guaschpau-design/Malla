import { describe, expect, it } from 'vitest';

import { LAYER_SWITCHES_MORE, LAYER_SWITCHES_SHOWN, MAP_FLAGS, MAP_LAYERS } from './layers.ts';

describe('map layers', () => {
  it('puts every layer and flag in exactly one place of the panel: in view, or folded', () => {
    const listed = [...LAYER_SWITCHES_SHOWN, ...LAYER_SWITCHES_MORE];
    expect(listed.sort()).toEqual([...MAP_LAYERS, ...MAP_FLAGS].sort());
  });
});
