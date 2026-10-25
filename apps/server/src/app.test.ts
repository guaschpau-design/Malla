import { describe, expect, it } from 'vitest';

import { buildApp } from './app.ts';

describe('server', () => {
  it('reports health and the protocol version it speaks', async () => {
    const app = buildApp();
    const response = await app.inject({ method: 'GET', url: '/healthz' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok', protocolVersion: 1 });
    await app.close();
  });
});
