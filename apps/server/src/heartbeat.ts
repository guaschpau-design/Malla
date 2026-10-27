// Liveness of WebSocket connections, the relay's clients and a command post's upstream links
// alike: a connection whose peer vanished without closing it (a phone out of coverage, a broken
// route) would otherwise stay open for many minutes.

import type WebSocket from 'ws';

/** Connections that do not answer a ping within this time are closed. */
export const HEARTBEAT_MS = 30_000;

/** Pings every watched socket on each beat and terminates those that missed the previous ping. */
export class Heartbeat {
  readonly #answered = new Map<WebSocket, boolean>();
  readonly #timer: ReturnType<typeof setInterval>;

  constructor(intervalMs: number = HEARTBEAT_MS) {
    this.#timer = setInterval(() => {
      this.#beat();
    }, intervalMs);
  }

  /** Watches an open socket until it closes. */
  watch(socket: WebSocket): void {
    this.#answered.set(socket, true);
    socket.on('pong', () => this.#answered.set(socket, true));
    socket.once('close', () => this.#answered.delete(socket));
  }

  stop(): void {
    clearInterval(this.#timer);
  }

  #beat(): void {
    for (const [socket, answered] of this.#answered) {
      if (!answered) {
        socket.terminate();
        continue;
      }
      this.#answered.set(socket, false);
      socket.ping();
    }
  }
}
