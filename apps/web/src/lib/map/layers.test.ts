import { describe, expect, it } from 'vitest';

import { LAYER_SWITCHES, MAP_FLAGS, MAP_LAYERS } from './layers.ts';

describe('map layers', () => {
  it('has one switch for every layer and flag', () => {
    const listed = LAYER_SWITCHES.map((item) => item.name);
    expect(listed.sort()).toEqual([...MAP_LAYERS, ...MAP_FLAGS].sort());
  });
});
