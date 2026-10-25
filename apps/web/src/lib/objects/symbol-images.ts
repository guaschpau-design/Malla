// Marker icons, drawn at runtime: a coloured disc with the symbol's emoji. Drawing them avoids
// shipping an icon set, and emoji are available on every platform the app runs on.

import type { Map as MapLibreMap } from 'maplibre-gl';

import { SYMBOLS, symbolImageName } from './catalog.ts';

const SIZE = 64; // pixels, drawn at 2× for sharp icons on high-density screens

/** Adds any missing symbol image to the map's current style. */
export function addSymbolImages(map: MapLibreMap): void {
  for (const symbol of SYMBOLS) {
    const name = symbolImageName(symbol.code);
    if (map.hasImage(name)) continue;
    const canvas = document.createElement('canvas');
    canvas.width = SIZE;
    canvas.height = SIZE;
    const context = canvas.getContext('2d');
    if (context === null) return;
    context.beginPath();
    context.arc(SIZE / 2, SIZE / 2, SIZE / 2 - 3, 0, 2 * Math.PI);
    context.fillStyle = '#ffffff';
    context.fill();
    context.lineWidth = 5;
    context.strokeStyle = symbol.color;
    context.stroke();
    context.font = `${String(SIZE * 0.5)}px system-ui, "Apple Color Emoji", "Noto Color Emoji", sans-serif`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(symbol.emoji, SIZE / 2, SIZE / 2 + 2);
    map.addImage(name, context.getImageData(0, 0, SIZE, SIZE), { pixelRatio: 2 });
  }
}
