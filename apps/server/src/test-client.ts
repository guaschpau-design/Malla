// A WebSocket client for server tests that queues every message the server sends.

import {
  encodeRelayMessage,
  parseServerMessage,
  type ClientMessage,
  type ServerMessage,
} from '@tesel/protocol';
import WebSocket from 'ws';

/** A test client that queues every message the server sends. */
export class TestClient {
  readonly #socket: WebSocket;
  readonly #queue: ServerMessage[] = [];
  readonly #closed: Promise<number>;
  #waiting: ((message: ServerMessage) => void) | null = null;

  private constructor(socket: WebSocket) {
    this.#socket = socket;
    this.#closed = new Promise((resolve) => socket.once('close', resolve));
    socket.on('message', (data) => {
      const text = Buffer.isBuffer(data) ? data.toString('utf8') : '';
      const message = parseServerMessage(text);
      if (message === null) throw new Error(`unparseable frame ${text}`);
      if (this.#waiting) {
        this.#waiting(message);
        this.#waiting = null;
      } else {
        this.#queue.push(message);
      }
    });
  }

  /** Connects; fails if the server refuses the connection. */
  static async connect(url: string, headers: Record<string, string> = {}): Promise<TestClient> {
    const socket = new WebSocket(url, { headers });
    await new Promise((resolve, reject) => {
      socket.once('open', resolve);
      socket.once('error', reject);
    });
    return new TestClient(socket);
  }

  send(message: ClientMessage): void {
    this.#socket.send(encodeRelayMessage(message));
  }

  sendRaw(text: string): void {
    this.#socket.send(text);
  }

  next(timeoutMs = 2000): Promise<ServerMessage> {
    const queued = this.#queue.shift();
    if (queued) return Promise.resolve(queued);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error('no message'));
      }, timeoutMs);
      this.#waiting = (message) => {
        clearTimeout(timer);
        resolve(message);
      };
    });
  }

  /** True if nothing arrives for a short while. */
  async isQuiet(): Promise<boolean> {
    await new Promise((resolve) => setTimeout(resolve, 100));
    return this.#queue.length === 0;
  }

  /** Stops reading from the server, as a client on a slow link would. */
  pause(): void {
    this.#socket.pause();
  }

  resume(): void {
    this.#socket.resume();
  }

  /** Resolves with the close code once the server or the client closes the connection. */
  closed(): Promise<number> {
    return this.#closed;
  }

  close(): void {
    this.#socket.close();
  }
}
