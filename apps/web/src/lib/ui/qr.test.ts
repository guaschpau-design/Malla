import { describe, expect, it } from 'vitest';

import { drawQr } from './qr.ts';

describe('QR drawing', () => {
  it('draws one square per dark module inside the quiet zone', () => {
    const { size, path } = drawQr('https://example.github.io/tesel/join#AQEHBwcH');
    const squares = path.match(/M(\d+) (\d+)h1v1h-1z/g) ?? [];
    expect(squares.length).toBeGreaterThan(0);
    for (const square of squares) {
      const [, x = '', y = ''] = /M(\d+) (\d+)/.exec(square) ?? [];
      expect(Number(x)).toBeGreaterThanOrEqual(4);
      expect(Number(y)).toBeLessThan(size - 4);
    }
  });

  it('fits the longest invitation link in a code a phone camera reads easily', () => {
    const longest = `https://example.github.io/tesel/join#${'A'.repeat(342)}`;
    // Version 15 is 77 modules plus the quiet zone.
    expect(drawQr(longest).size).toBeLessThanOrEqual(77 + 8);
  });
});
