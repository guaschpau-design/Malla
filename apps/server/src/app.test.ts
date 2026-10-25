import { describe, expect, it } from 'vitest';

import { buildApp } from './app.ts';
import { EnvelopeStore } from './envelope-store.ts';
import { Relay } from './relay.ts';

describe('server', () => {
  it('reports health and the protocol version it speaks', async () => {
    const app = await buildApp(new Relay(new EnvelopeStore(':memory:'), Date.now));
    const response = await app.inject({ method: 'GET', url: '/healthz' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok', protocolVersion: 1 });
    await app.close();
  });
});
