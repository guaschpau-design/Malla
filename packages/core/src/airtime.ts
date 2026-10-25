// How long a LoRa packet occupies the air (Semtech AN1200.13 time-on-air formula), used to
// keep within the EU duty cycle (ARCHITECTURE.md §4.2).

export interface LoraPreset {
  readonly spreadingFactor: number;
  readonly bandwidthHz: number;
  /** 1 to 4 for coding rates 4/5 to 4/8. */
  readonly codingRate: number;
  readonly preambleSymbols: number;
}

/**
 * MeshCore's "EU/UK (Narrow)" preset: 869.618 MHz, 62.5 kHz, SF8. The coding rate and preamble
 * are taken at their most expensive plausible values so estimates err on the safe side.
 */
export const EU_NARROW: LoraPreset = {
  spreadingFactor: 8,
  bandwidthHz: 62_500,
  codingRate: 4,
  preambleSymbols: 16,
};

/**
 * Bytes MeshCore adds around a channel datagram: header, path length, channel hash and MAC,
 * plus the data type and padding of the encrypted part to 16-byte AES blocks.
 */
export function meshcorePacketSize(eventBytes: number): number {
  const encrypted = Math.ceil((eventBytes + 2) / 16) * 16;
  return 5 + encrypted;
}

/** Time on air of a packet with `payloadBytes` bytes, in milliseconds. */
export function timeOnAirMs(payloadBytes: number, preset: LoraPreset = EU_NARROW): number {
  const { spreadingFactor: sf, bandwidthHz, codingRate, preambleSymbols } = preset;
  const symbolMs = (2 ** sf / bandwidthHz) * 1000;
  const lowDataRateOptimize = symbolMs > 16 ? 1 : 0;
  const payloadSymbols =
    8 +
    Math.max(
      Math.ceil((8 * payloadBytes - 4 * sf + 28 + 16) / (4 * (sf - 2 * lowDataRateOptimize))) *
        (codingRate + 4),
      0,
    );
  return (preambleSymbols + 4.25 + payloadSymbols) * symbolMs;
}

/** Time on air of one Teselia event sent through MeshCore. */
export function eventAirtimeMs(eventBytes: number, preset: LoraPreset = EU_NARROW): number {
  return timeOnAirMs(meshcorePacketSize(eventBytes), preset);
}
