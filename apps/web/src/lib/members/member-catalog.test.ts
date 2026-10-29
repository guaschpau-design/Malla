import { describe, expect, it } from 'vitest';

import { EQUIPMENT, ownEquipment } from './member-catalog.ts';

describe('what this person carries', () => {
  it('adds the LoRa radio while one is linked, and never keeps one picked by hand', () => {
    expect(ownEquipment(['water'], true)).toEqual(['water', 'lora']);
    expect(ownEquipment(['water'], false)).toEqual(['water']);
    expect(ownEquipment(['lora', 'rope'], false)).toEqual(['rope']);
    expect(ownEquipment(['lora'], true)).toEqual(['lora']);
  });

  it('never offers the LoRa radio to pick by hand', () => {
    expect(EQUIPMENT.map((item) => item.value)).not.toContain('lora');
  });
});
