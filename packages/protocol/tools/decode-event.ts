// Prints an encoded event as JSON, for debugging (ADR-0004).
//
//   pnpm --filter @teselia/protocol decode 0104a1b2c3d4010000000013fc68486f6c61
//
// Accepts hex or base64url. Byte arrays are printed as hex.

import { decodeEvent, fromBase64url, peekHeader } from '../src/index.ts';

function parseInput(text: string): Uint8Array | null {
  const compact = text.replace(/\s+/g, '');
  if (/^([0-9a-fA-F]{2})+$/.test(compact)) {
    return Uint8Array.from(compact.match(/../g) ?? [], (pair) => Number.parseInt(pair, 16));
  }
  return fromBase64url(compact);
}

function toJson(value: unknown): string {
  return JSON.stringify(
    value,
    (_key, field: unknown) =>
      field instanceof Uint8Array ? Buffer.from(field).toString('hex') : field,
    2,
  );
}

const input = process.argv[2];
const bytes = input === undefined ? null : parseInput(input);
if (bytes === null) {
  console.error('usage: decode-event <hex | base64url>');
  process.exit(2);
}

const decoded = decodeEvent(bytes);
if (decoded.ok) {
  process.stdout.write(`${toJson(decoded.value)}\n`);
} else {
  const header = peekHeader(bytes);
  process.stdout.write(
    `${toJson({ error: decoded.error, header: header.ok ? header.value : null, size: bytes.length })}\n`,
  );
  process.exit(1);
}
