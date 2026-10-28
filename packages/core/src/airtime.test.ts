import { describe, expect, it } from 'vitest';

import { AirtimeWindow, eventAirtimeMs, timeOnAirMs } from './airtime.ts';

describe('LoRa airtime', () => {
  it('matches the reference time on air for SF7, 125 kHz, 4/5', () => {
    // Semtech calculator: 20-byte payload, 8-symbol preamble, explicit header, CRC on.
    const ms = timeOnAirMs(20, {
      spreadingFactor: 7,
      bandwidthHz: 125_000,
      codingRate: 1,
      preambleSymbols: 8,
    });
    expect(ms).toBeCloseTo(56.58, 1);
  });

  it('puts the largest Tesel event at well over a second on the narrow EU preset', () => {
    expect(eventAirtimeMs(165)).toBeGreaterThan(1000);
    expect(eventAirtimeMs(165)).toBeLessThan(2500);
    expect(eventAirtimeMs(28)).toBeLessThan(eventAirtimeMs(165));
  });
});

describe('an airtime window', () => {
  it('counts what was sent within the window, and forgets what slid out of it', () => {
    const window = new AirtimeWindow(60_000);
    window.add(0, 300);
    window.add(30_000, 200);
    expect(window.usedMs(30_000)).toBe(500);
    expect(window.usedMs(60_000)).toBe(500);
    expect(window.usedMs(60_001)).toBe(200);
    expect(window.usedMs(90_001)).toBe(0);
  });
});
