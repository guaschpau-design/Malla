// How marker symbols and shape styles (protocol §4) look in this app. Unknown codes fall back to
// the generic symbol and the neutral style, as the protocol requires.

import type { MessageKey } from '../i18n/index.ts';

export interface SymbolInfo {
  readonly code: number;
  readonly label: MessageKey;
  readonly emoji: string;
  readonly color: string;
}

export const SYMBOLS: readonly SymbolInfo[] = [
  { code: 0x0000, label: 'symbolGeneric', emoji: '📍', color: '#475569' },
  { code: 0x0001, label: 'symbolInjured', emoji: '🩹', color: '#dc2626' },
  { code: 0x0002, label: 'symbolMissing', emoji: '🔎', color: '#7c3aed' },
  { code: 0x0003, label: 'symbolFire', emoji: '🔥', color: '#ea580c' },
  { code: 0x0004, label: 'symbolFlood', emoji: '🌊', color: '#0284c7' },
  { code: 0x0005, label: 'symbolHazard', emoji: '⚠️', color: '#ca8a04' },
  { code: 0x0006, label: 'symbolBlockedRoad', emoji: '🚧', color: '#b45309' },
  { code: 0x0007, label: 'symbolShelter', emoji: '🏠', color: '#16a34a' },
  { code: 0x0008, label: 'symbolMeetingPoint', emoji: '🚩', color: '#0d9488' },
  { code: 0x0009, label: 'symbolMedicalPost', emoji: '⚕️', color: '#e11d48' },
  { code: 0x000a, label: 'symbolWater', emoji: '💧', color: '#2563eb' },
  { code: 0x000b, label: 'symbolHelicopter', emoji: '🚁', color: '#4f46e5' },
  { code: 0x000c, label: 'symbolCommandPost', emoji: '⛺', color: '#1e293b' },
];

export interface StyleInfo {
  readonly code: number;
  readonly label: MessageKey;
  readonly color: string;
}

export const SHAPE_STYLES: readonly StyleInfo[] = [
  { code: 0x0000, label: 'styleNeutral', color: '#475569' },
  { code: 0x0001, label: 'styleDanger', color: '#dc2626' },
  { code: 0x0002, label: 'styleSearchAssigned', color: '#d97706' },
  { code: 0x0003, label: 'styleSearchCleared', color: '#16a34a' },
  { code: 0x0004, label: 'styleSafe', color: '#0d9488' },
  { code: 0x0005, label: 'styleRoute', color: '#2563eb' },
];

export function symbolInfo(code: number): SymbolInfo {
  return SYMBOLS.find((symbol) => symbol.code === code) ?? (SYMBOLS[0] as SymbolInfo);
}

export function styleInfo(code: number): StyleInfo {
  return SHAPE_STYLES.find((style) => style.code === code) ?? (SHAPE_STYLES[0] as StyleInfo);
}

/** Name of the map image drawn for a symbol (see symbol-images.ts). */
export function symbolImageName(code: number): string {
  return `teselia-symbol-${String(symbolInfo(code).code)}`;
}
