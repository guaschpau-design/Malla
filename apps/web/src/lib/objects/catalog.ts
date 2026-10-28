// How marker symbols and shape styles (protocol §4) look in this app: a pictogram (ui/glyphs.ts) and
// a family of colour (app.css). Unknown codes fall back to the generic symbol and the neutral
// style, as the protocol requires.

import type { MarkerEvent, ShapeEvent } from '@tesel/protocol';

import type { MessageKey } from '../i18n/index.ts';
import type { Tone } from '../ui/theme.ts';
import type { GlyphName } from '../ui/glyphs.ts';

export interface SymbolInfo {
  readonly code: number;
  readonly label: MessageKey;
  readonly glyph: GlyphName;
  readonly tone: Tone;
}

// Families: people and health in red, hazards in orange and amber, water in blue, safety and
// logistics in green, command in ink.
/** Also what a symbol this version does not know is drawn as (protocol §3.1, reserved values). */
const GENERIC_SYMBOL: SymbolInfo = {
  code: 0x0000,
  label: 'symbolGeneric',
  glyph: 'point',
  tone: 'slate',
};

export const SYMBOLS: readonly SymbolInfo[] = [
  GENERIC_SYMBOL,
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

/** §4.2: an area to keep out of; each device warns its user on entering one. */
export const DANGER_STYLE = 0x0001;
/** §4.2: the area the group works in, whose map members are offered to download. */
export const OPERATION_AREA_STYLE = 0x0006;

export interface StyleInfo {
  readonly code: number;
  readonly label: MessageKey;
  readonly tone: Tone;
}

/** Also what a style this version does not know is drawn as. */
const NEUTRAL_STYLE: StyleInfo = { code: 0x0000, label: 'styleNeutral', tone: 'slate' };

const SHAPE_STYLES: readonly StyleInfo[] = [
  NEUTRAL_STYLE,
  { code: DANGER_STYLE, label: 'styleDanger', tone: 'red' },
  { code: 0x0002, label: 'styleSearchAssigned', tone: 'amber' },
  { code: 0x0003, label: 'styleSearchCleared', tone: 'green' },
  { code: 0x0004, label: 'styleSafe', tone: 'teal' },
  { code: 0x0005, label: 'styleRoute', tone: 'blue' },
  { code: OPERATION_AREA_STYLE, label: 'styleOperationArea', tone: 'ink' },
];

/**
 * The styles offered when drawing an area: all but the route, which is for lines, and the
 * operation area only for coordinators (a UI rule, like alerts: ADR-0005).
 */
export function areaStyles(coordinator: boolean): StyleInfo[] {
  return SHAPE_STYLES.filter(
    (style) => style.label !== 'styleRoute' && (coordinator || style.code !== OPERATION_AREA_STYLE),
  );
}

export function symbolInfo(code: number): SymbolInfo {
  return SYMBOLS.find((symbol) => symbol.code === code) ?? GENERIC_SYMBOL;
}

export function styleInfo(code: number): StyleInfo {
  return SHAPE_STYLES.find((style) => style.code === code) ?? NEUTRAL_STYLE;
}

/** Name of the map image drawn for a symbol (see symbol-images.ts). */
export function symbolImageName(code: number): string {
  return `tesel-symbol-${String(symbolInfo(code).code)}`;
}

/** The name of what an object is: its symbol, or its style. */
export function objectKind(object: MarkerEvent | ShapeEvent): MessageKey {
  return object.type === 'marker' ? symbolInfo(object.symbol).label : styleInfo(object.style).label;
}
