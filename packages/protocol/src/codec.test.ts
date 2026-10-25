import { describe, expect, it } from 'vitest';

import { decodeEvent, encodeEvent } from './codec.ts';
import { MAX_EVENT_SIZE } from './constants.ts';
import type { MallaEvent, ShapeEvent } from './events.ts';
import { ALICE, BOB, hex, SAMPLE_EVENTS, seededRandom, T0, toHex } from './test-helpers.ts';

function encodeOrFail(event: MallaEvent): Uint8Array {
  const result = encodeEvent(event);
  if (!result.ok) throw new Error(`encoding failed: ${result.error.detail}`);
  return result.value;
}

function decodeError(bytes: Uint8Array): string {
  const result = decodeEvent(bytes);
  if (result.ok) throw new Error('expected decoding to fail');
  return result.error.code;
}

describe('event codec', () => {
  it.each(SAMPLE_EVENTS.map((event) => [event.type, event] as const))(
    'round-trips a %s event',
    (_type, event) => {
      const bytes = encodeOrFail(event);
      expect(bytes.length).toBeLessThanOrEqual(MAX_EVENT_SIZE);
      expect(decodeEvent(bytes)).toEqual({ ok: true, value: event });
    },
  );

  it('matches the chat test vector computed independently from the spec', () => {
    const event: MallaEvent = { type: 'chat', origin: ALICE, seq: 1, time: T0, text: 'Hola' };
    expect(toHex(encodeOrFail(event))).toBe('0104a1b2c3d4010000000013fc68486f6c61');
  });

  it('matches the position test vector computed independently from the spec', () => {
    const event: MallaEvent = {
      type: 'position',
      origin: ALICE,
      seq: 7,
      time: T0,
      lat: 41.3874,
      lon: 2.1686,
      accuracy: 5,
      heading: 90,
      speed: 1.5,
    };
    const bytes = encodeOrFail(event);
    expect(bytes.length).toBe(28);
    expect(toHex(bytes)).toBe('0102a1b2c3d4070000000013fc685037ab18f0e64a0105005a009600');
  });

  describe('encoding limits', () => {
    it('accepts a chat text that fills the event exactly', () => {
      const event: MallaEvent = {
        type: 'chat',
        origin: BOB,
        seq: 1,
        time: T0,
        text: 'x'.repeat(151),
      };
      expect(encodeOrFail(event).length).toBe(MAX_EVENT_SIZE);
    });

    it('refuses a chat text one byte too long', () => {
      const event: MallaEvent = {
        type: 'chat',
        origin: BOB,
        seq: 1,
        time: T0,
        text: 'x'.repeat(152),
      };
      const result = encodeEvent(event);
      expect(result.ok ? null : result.error.code).toBe('too-large');
    });

    it('counts text limits in UTF-8 bytes, not characters', () => {
      const event: MallaEvent = {
        type: 'chat',
        origin: BOB,
        seq: 1,
        time: T0,
        text: 'ñ'.repeat(76),
      };
      expect(encodeEvent(event).ok).toBe(false); // 152 bytes
    });

    it('refuses sequence number 0', () => {
      const event: MallaEvent = { type: 'position-hidden', origin: BOB, seq: 0, time: T0 };
      expect(encodeEvent(event).ok).toBe(false);
    });

    it('saturates huge measurements below the unknown marker', () => {
      const event: MallaEvent = {
        type: 'position',
        origin: BOB,
        seq: 1,
        time: T0,
        lat: 0,
        lon: 0,
        accuracy: 1e9,
        heading: 360,
        speed: 1e6,
      };
      const decoded = decodeEvent(encodeOrFail(event));
      expect(decoded.ok && decoded.value).toMatchObject({
        accuracy: 65534,
        heading: 0,
        speed: 655.34,
      });
    });
  });

  describe('shapes', () => {
    const baseShape = {
      type: 'shape',
      origin: ALICE,
      seq: 1,
      time: T0,
      object: { origin: ALICE, seq: 1 },
      style: 0,
      label: '',
    } as const;

    function line(count: number, step: number): ShapeEvent {
      const points = Array.from({ length: count }, (_, i) => ({ lat: 40 + i * step, lon: -3 }));
      return { ...baseShape, geometry: { kind: 'polyline', points } };
    }

    it('fits 33 points with an empty label', () => {
      expect(encodeOrFail(line(33, 0.001)).length).toBe(163);
    });

    it('refuses a 34th point', () => {
      expect(encodeEvent(line(34, 0.001)).ok).toBe(false);
    });

    it('refuses consecutive points too far apart for a 16-bit delta', () => {
      expect(encodeEvent(line(2, 0.4)).ok).toBe(false);
    });

    it('refuses a polygon whose last point repeats the first', () => {
      const p = { lat: 40, lon: -3 };
      const event: ShapeEvent = {
        ...baseShape,
        geometry: {
          kind: 'polygon',
          points: [p, { lat: 40.001, lon: -3 }, { lat: 40, lon: -2.999 }, p],
        },
      };
      expect(encodeEvent(event).ok).toBe(false);
    });

    it('does not accumulate rounding error along a long line', () => {
      const points = Array.from({ length: 30 }, (_, i) => ({
        lat: 40 + i * 0.0012345,
        lon: -3 + (i % 2) * 0.0006789,
      }));
      const event: ShapeEvent = { ...baseShape, geometry: { kind: 'polyline', points } };
      const decoded = decodeEvent(encodeOrFail(event));
      if (
        !decoded.ok ||
        decoded.value.type !== 'shape' ||
        decoded.value.geometry.kind !== 'polyline'
      ) {
        throw new Error('expected a polyline');
      }
      decoded.value.geometry.points.forEach((point, i) => {
        const original = points[i];
        expect(Math.abs(point.lat - (original?.lat ?? NaN))).toBeLessThanOrEqual(0.5e-5 + 1e-9);
        expect(Math.abs(point.lon - (original?.lon ?? NaN))).toBeLessThanOrEqual(0.5e-5 + 1e-9);
      });
    });
  });

  describe('decoding untrusted input', () => {
    const chat = hex('0104a1b2c3d4010000000013fc68486f6c61');

    it('rejects an unsupported protocol version', () => {
      expect(decodeError(Uint8Array.of(2, ...chat.slice(1)))).toBe('unsupported-version');
    });

    it('reports an unknown event type so receivers can ignore it', () => {
      expect(decodeError(Uint8Array.of(1, 0xee, ...chat.slice(2)))).toBe('unknown-type');
    });

    it('rejects a truncated header', () => {
      expect(decodeError(chat.slice(0, 10))).toBe('truncated');
    });

    it('rejects bytes after the last field', () => {
      const ack = encodeOrFail({
        type: 'ack',
        origin: ALICE,
        seq: 1,
        time: T0,
        target: { origin: BOB, seq: 2 },
      });
      expect(decodeError(Uint8Array.of(...ack, 0))).toBe('trailing-bytes');
    });

    it('rejects invalid UTF-8', () => {
      expect(decodeError(Uint8Array.of(...chat.slice(0, 14), 0xff, 0xfe))).toBe('invalid-utf8');
    });

    it('rejects an out-of-range latitude', () => {
      const position = hex(
        '0102a1b2c3d4070000000013fc68' + '00ca9a3b' + '00000000' + 'ffffffffffff',
      );
      expect(decodeError(position)).toBe('invalid-value'); // 100° latitude
    });

    it('rejects sequence number 0', () => {
      expect(decodeError(hex('0103a1b2c3d4000000000013fc68'))).toBe('invalid-value');
    });

    it('shows a reserved SOS kind as general', () => {
      const sos = encodeOrFail({
        type: 'sos',
        origin: BOB,
        seq: 1,
        time: T0,
        kind: 'fire',
        lat: 1,
        lon: 1,
        accuracy: null,
        text: '',
      });
      sos[14] = 200;
      const decoded = decodeEvent(sos);
      expect(decoded.ok && decoded.value.type === 'sos' && decoded.value.kind).toBe('general');
    });

    it('never throws on random input', () => {
      const random = seededRandom(42);
      for (let i = 0; i < 5000; i++) {
        const length = random(1)[0] ?? 0;
        const bytes = random(length % 200);
        if (bytes.length > 1) {
          bytes[0] = 1; // valid version, so decoding goes deep
          bytes[1] = (bytes[1] ?? 0) % 0x0c;
        }
        expect(() => decodeEvent(bytes)).not.toThrow();
      }
    });
  });
});
