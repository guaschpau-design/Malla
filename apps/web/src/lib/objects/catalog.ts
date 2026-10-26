// How marker symbols and shape styles (protocol §4) look in this app: a pictogram (glyphs.ts) and
// a family of colour (app.css). Unknown codes fall back to the generic symbol and the neutral
// style, as the protocol requires.

import type { MessageKey } from '../i18n/index.ts';
import type { Tone } from '../ui/theme.ts';
import type { GlyphName } from './glyphs.ts';

export interface SymbolInfo {
  readonly code: number;
  readonly label: MessageKey;
  readonly glyph: GlyphName;
  readonly tone: Tone;
}

// Families: people and health in red, hazards in orange and amber, water in blue, safety and
// logistics in green, command in ink.
export const SYMBOLS: readonly SymbolInfo[] = [
  { code: 0x0000, label: 'symbolGeneric', glyph: 'point', tone: 'slate' },
  { code: 0x0001, label: 'symbolInjured', glyph: 'injured', tone: 'red' },
  { code: 0x0002, label: 'symbolMissing', glyph: 'search', tone: 'red' },
  { code: 0x0003, label: 'symbolFire', glyph: 'flame', tone: 'orange' },
  { code: 0x0004, label: 'symbolFlood', glyph: 'waves', tone: 'blue' },
  { code: 0x0005, label: 'symbolHazard', glyph: 'warning', tone: 'amber' },
  { code: 0x0006, label: 'symbolBlockedRoad', glyph: 'barrier', tone: 'amber' },
  { code: 0x0007, label: 'symbolShelter', glyph: 'house', tone: 'green' },
  { code: 0x0008, label: 'symbolMeetingPoint', glyph: 'flag', tone: 'green' },
  { code: 0x0009, label: 'symbolMedicalPost', glyph: 'cross', tone: 'red' },
  { code: 0x000a, label: 'symbolWater', glyph: 'drop', tone: 'blue' },
  { code: 0x000b, label: 'symbolHelicopter', glyph: 'helipad', tone: 'green' },
  { code: 0x000c, label: 'symbolCommandPost', glyph: 'mast', tone: 'ink' },
];

export interface StyleInfo {
  readonly code: number;
  readonly label: MessageKey;
  readonly tone: Tone;
}

export const SHAPE_STYLES: readonly StyleInfo[] = [
  { code: 0x0000, label: 'styleNeutral', tone: 'slate' },
  { code: 0x0001, label: 'styleDanger', tone: 'red' },
  { code: 0x0002, label: 'styleSearchAssigned', tone: 'amber' },
  { code: 0x0003, label: 'styleSearchCleared', tone: 'green' },
  { code: 0x0004, label: 'styleSafe', tone: 'teal' },
  { code: 0x0005, label: 'styleRoute', tone: 'blue' },
];

export function symbolInfo(code: number): SymbolInfo {
  return SYMBOLS.find((symbol) => symbol.code === code) ?? (SYMBOLS[0] as SymbolInfo);
}

export function styleInfo(code: number): StyleInfo {
  return SHAPE_STYLES.find((style) => style.code === code) ?? (SHAPE_STYLES[0] as StyleInfo);
}

/** Name of the map image drawn for a symbol (see symbol-images.ts). */
export function symbolImageName(code: number): string {
  return `tesel-symbol-${String(symbolInfo(code).code)}`;
}
