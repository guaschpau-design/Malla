// RFC 4648 §5 base64url without padding (docs/protocol.md §1).

const ALPHABET = Array.from('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_');
const LOOKUP = new Map(ALPHABET.map((char, index) => [char, index]));

export function toBase64url(bytes: Uint8Array): string {
  let output = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i] ?? 0;
    const b1 = bytes[i + 1] ?? 0;
    const b2 = bytes[i + 2] ?? 0;
    const chunk = (b0 << 16) | (b1 << 8) | b2;
    const chars = Math.min(4, Math.ceil(((bytes.length - i) * 8) / 6));
    for (let c = 0; c < chars; c++) {
      output += ALPHABET[(chunk >>> (18 - c * 6)) & 0x3f] ?? '';
    }
  }
  return output;
}

/** Returns null for anything that is not canonical unpadded base64url. */
export function fromBase64url(text: string): Uint8Array | null {
  if (text.length % 4 === 1) return null;
  const bytes = new Uint8Array(Math.floor((text.length * 6) / 8));
  let buffer = 0;
  let bits = 0;
  let index = 0;
  for (const char of text) {
    const value = LOOKUP.get(char);
    if (value === undefined) return null;
    buffer = (buffer << 6) | value;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes[index++] = (buffer >>> bits) & 0xff;
    }
    buffer &= (1 << bits) - 1; // keep only bits not yet emitted
  }
  // Leftover bits must be zero, otherwise two strings would decode to the same bytes.
  if ((buffer & ((1 << bits) - 1)) !== 0) return null;
  return bytes;
}
