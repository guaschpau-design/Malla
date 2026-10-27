import { EventEmitter } from 'node:events';

import { afterEach, describe, expect, it, vi } from 'vitest';
import type WebSocket from 'ws';

import { Heartbeat } from './heartbeat.ts';

/** Enough of a socket for the heartbeat: it can be pinged, answer and be terminated. */
class FakeSocket extends EventEmitter {
  pings = 0;
  terminated = false;
  ping(): void {
    this.pings += 1;
  }
  terminate(): void {
    this.terminated = true;
  }
}

afterEach(() => {
  vi.useRealTimers();
});

describe('heartbeat', () => {
  it('pings watched sockets and terminates those that stop answering', () => {
    vi.useFakeTimers();
    const heartbeat = new Heartbeat(1000);
    const answering = new FakeSocket();
    const silent = new FakeSocket();
    heartbeat.watch(answering as unknown as WebSocket);
    heartbeat.watch(silent as unknown as WebSocket);

    vi.advanceTimersByTime(1000);
    expect([answering.pings, silent.pings]).toEqual([1, 1]);
    answering.emit('pong');
    vi.advanceTimersByTime(1000);
    expect(answering.terminated).toBe(false);
    expect(silent.terminated).toBe(true);
    heartbeat.stop();
  });

  it('forgets a socket once it closes', () => {
    vi.useFakeTimers();
    const heartbeat = new Heartbeat(1000);
    const socket = new FakeSocket();
    heartbeat.watch(socket as unknown as WebSocket);
    socket.emit('close');
    vi.advanceTimersByTime(3000);
    expect(socket.pings).toBe(0);
    heartbeat.stop();
  });
});
