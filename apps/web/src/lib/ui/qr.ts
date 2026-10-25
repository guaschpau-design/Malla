// QR codes drawn as one SVG path, so components need no raw HTML.

import { encode } from 'uqr';

export interface QrDrawing {
  /** Width and height in modules, including the quiet zone. */
  readonly size: number;
  /** SVG path data with one unit square per dark module. */
  readonly path: string;
}

/** Quiet zone required around a QR code by the standard, in modules. */
const QUIET_ZONE = 4;

export function drawQr(text: string): QrDrawing {
  // Level M survives a scratched or badly lit screen without making the code much denser.
  const { data, size } = encode(text, { ecc: 'M', border: QUIET_ZONE });
  let path = '';
  data.forEach((row, y) => {
    row.forEach((dark, x) => {
      if (dark) path += `M${x} ${y}h1v1h-1z`;
    });
  });
  return { size, path };
}
