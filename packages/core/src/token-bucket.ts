// Rate limiting: a bucket holds up to `capacity` tokens and refills continuously.

export class TokenBucket {
  readonly #capacity: number;
  readonly #perMs: number;
  #tokens: number;
  #updatedAt: number;

  constructor(capacity: number, refillPerSecond: number, now: number) {
    this.#capacity = capacity;
    this.#perMs = refillPerSecond / 1000;
    this.#tokens = capacity;
    this.#updatedAt = now;
  }

  /** Takes one token if there is one. */
  take(now: number): boolean {
    const elapsed = Math.max(0, now - this.#updatedAt);
    this.#tokens = Math.min(this.#capacity, this.#tokens + elapsed * this.#perMs);
    this.#updatedAt = now;
    if (this.#tokens < 1) return false;
    this.#tokens -= 1;
    return true;
  }
}
