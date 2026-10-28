// Whether this device's clock is right, as far as the servers it talks to can tell (protocol §8.1,
// ADR-0044). Events are stamped with it, and a clock that is wrong orders the group's edits wrong.

/** Off by more than this, the user is told. Phones set by the network are within a second. */
const CLOCK_TOLERANCE_S = 120;

class DeviceClock {
  /** How far this clock runs ahead of the last server's, in seconds; negative if behind. */
  offsetSeconds: number | null = $state(null);

  /**
   * Notes a server's time, read from an answer asked for at `sentAt` and received at
   * `receivedAt` (milliseconds of this clock): the server's time is taken as of halfway between.
   */
  observe(serverTime: number, sentAt: number, receivedAt: number): void {
    this.offsetSeconds = Math.round((sentAt + receivedAt) / 2000 - serverTime);
  }

  /** The error worth telling the user about, in whole minutes, or null if the clock is right. */
  get wrongByMinutes(): number | null {
    const offset = this.offsetSeconds;
    if (offset === null || Math.abs(offset) <= CLOCK_TOLERANCE_S) return null;
    return Math.round(offset / 60);
  }
}

export const deviceClock = new DeviceClock();
