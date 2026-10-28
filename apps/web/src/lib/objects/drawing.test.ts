import { describe, expect, it } from 'vitest';

import { MAX_SHAPE_POINTS } from './draft.ts';
import { Drawing } from './drawing.svelte.ts';

const at = (n: number) => ({ lat: 39.47 + n / 1000, lon: -0.37 });

describe('drawing', () => {
  it('places points, then describes the object, then stops', () => {
    const drawing = new Drawing();
    drawing.start('area');
    expect(drawing.placingPoints).toBe(true);
    drawing.add(at(1));
    drawing.add(at(2));
    drawing.undo();
    expect(drawing.draft?.points).toEqual([at(1)]);
    drawing.finish();
    expect(drawing.placingPoints).toBe(false);
    expect(drawing.describing).toBe(true);
    drawing.stop();
    expect(drawing.draft).toBeNull();
    expect(drawing.describing).toBe(false);
  });

  it('goes on to describing a marker at its one point, and an area once no more points fit', () => {
    const marker = new Drawing();
    marker.start('marker');
    marker.add(at(1));
    expect(marker.describing).toBe(true);

    const area = new Drawing();
    area.start('area');
    for (let n = 0; n < MAX_SHAPE_POINTS; n++) area.add(at(n));
    expect(area.describing).toBe(true);
  });
});
