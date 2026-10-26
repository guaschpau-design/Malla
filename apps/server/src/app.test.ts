import { parseServerInfo } from '@tesel/protocol';
import { describe, expect, it } from 'vitest';

import { buildApp } from './app.ts';
import { EnvelopeStore } from './envelope-store.ts';
import { Relay } from './relay.ts';

const relay = () => new Relay(new EnvelopeStore(':memory:'), Date.now);

describe('server', () => {
  it('reports health and the protocol version it speaks', async () => {
    const app = await buildApp(relay());
    const response = await app.inject({ method: 'GET', url: '/healthz' });
    expect(response.statusCode).toBe(200);
    expect(parseServerInfo(response.body)).toEqual({
      protocolVersion: 1,
      upstream: null,
      commandPost: null,
    });
    await app.close();
  });

  it('tells clients about its command posts and its upstream', async () => {
    const app = await buildApp(relay(), {
      webRoot: null,
      upstream: 'https://tesel.example/',
      commandPost: 'https://post.tesel.example/',
      weather: null,
    });
    const response = await app.inject({ method: 'GET', url: '/healthz' });
    expect(parseServerInfo(response.body)).toEqual({
      protocolVersion: 1,
      upstream: 'https://tesel.example/',
      commandPost: 'https://post.tesel.example/',
    });
    await app.close();
  });
});
