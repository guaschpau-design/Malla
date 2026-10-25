import { describe, expect, it } from 'vitest';

import { drawQr } from '../ui/qr.ts';
import { decodeQr, type Frame } from './qr-scanning.ts';

/** Renders a QR drawing as a camera would see it: RGBA pixels, `scale` pixels per module. */
function render(text: string, scale: number): Frame {
  const { size, path } = drawQr(text);
  const dark = new Set([...path.matchAll(/M(\d+) (\d+)/g)].map(([, x, y]) => `${x},${y}`));
  const width = size * scale;
  const data = new Uint8ClampedArray(width * width * 4);
  for (let py = 0; py < width; py++) {
    for (let px = 0; px < width; px++) {
      const isDark = dark.has(`${Math.floor(px / scale)},${Math.floor(py / scale)}`);
      data.fill(isDark ? 0 : 255, (py * width + px) * 4, (py * width + px) * 4 + 3);
      data[(py * width + px) * 4 + 3] = 255;
    }
  }
  return { data, width, height: width };
}

describe('QR scanning', () => {
  it('reads back an invitation link drawn by the app', () => {
    const link = `https://example.github.io/Malla/join#${'AQEHBwcHBwcHBwcHBwcHBwcH'.repeat(8)}`;
    expect(decodeQr(render(link, 4))).toBe(link);
  });

  it('finds nothing in an empty frame', () => {
    const blank = new Uint8ClampedArray(64 * 64 * 4).fill(255);
    expect(decodeQr({ data: blank, width: 64, height: 64 })).toBeNull();
  });
});
