import { parseServerInfo } from '@tesel/protocol';
import { describe, expect, it, vi } from 'vitest';

import { buildApp } from './app.ts';
import { EnvelopeStore } from './envelope-store.ts';
import { Relay } from './relay.ts';

const OPTIONS = {
  webRoot: null,
  upstream: 'https://tesel.example/',
  commandPost: 'https://post.tesel.example/',
  weather: null,
  trustedProxies: [],
};

async function app(options = OPTIONS) {
  const store = new EnvelopeStore(':memory:');
  return { store, app: await buildApp(store, new Relay(store), options) };
}

describe('server', () => {
  it('reports health, the protocol version it speaks and its clock', async () => {
    const store = new EnvelopeStore(':memory:');
    const server = await buildApp(store, new Relay(store));
    const response = await server.inject({ method: 'GET', url: '/healthz' });
    expect(response.statusCode).toBe(200);
    expect(response.headers['access-control-allow-origin']).toBe('*');
    expect(parseServerInfo(response.body)).toEqual({
      protocolVersion: 1,
      upstream: null,
      commandPost: null,
    });
    const { time } = response.json<{ time: number }>();
    expect(Math.abs(time - Date.now() / 1000)).toBeLessThan(5);
    await server.close();
  });

  it('tells clients about its command posts and its upstream', async () => {
    const { app: server } = await app();
    const response = await server.inject({ method: 'GET', url: '/healthz' });
    expect(parseServerInfo(response.body)).toEqual({
      protocolVersion: 1,
      upstream: 'https://tesel.example/',
      commandPost: 'https://post.tesel.example/',
    });
    await server.close();
  });

  it('answers 503 when its database does not', async () => {
    const { store, app: server } = await app();
    store.close();
    const response = await server.inject({ method: 'GET', url: '/healthz' });
    expect(response.statusCode).toBe(503);
    expect(response.headers['access-control-allow-origin']).toBe('*');
    expect(parseServerInfo(response.body)).toBeNull();
    await server.close();
  });

  it('logs the errors it answers with 500, without the request’s details', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { app: server } = await app();
    server.get('/broken', () => {
      throw new Error('boom');
    });
    const response = await server.inject({ method: 'GET', url: '/broken?secret=1' });
    expect(response.statusCode).toBe(500);
    expect(error).toHaveBeenCalledWith('GET /broken failed:', expect.any(Error));
    error.mockRestore();
    await server.close();
  });
});
