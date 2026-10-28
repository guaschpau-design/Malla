import { parseServerInfo } from '@tesel/protocol';
import { describe, expect, it, vi } from 'vitest';

import { testServer } from './test-server.ts';

describe('server', () => {
  it('reports health, the protocol version it speaks and its clock', async () => {
    const { app: server } = await testServer();
    const response = await server.inject({ method: 'GET', url: '/healthz' });
    expect(response.statusCode).toBe(200);
    expect(response.headers['access-control-allow-origin']).toBe('*');
    const info = parseServerInfo(response.body);
    expect(info?.protocolVersion).toBe(1);
    expect(Math.abs((info?.time ?? 0) - Date.now() / 1000)).toBeLessThan(5);
    await server.close();
  });

  it('answers 503 when its database does not', async () => {
    const { store, app: server } = await testServer();
    store.close();
    const response = await server.inject({ method: 'GET', url: '/healthz' });
    expect(response.statusCode).toBe(503);
    expect(response.headers['access-control-allow-origin']).toBe('*');
    expect(parseServerInfo(response.body)).toBeNull();
    await server.close();
  });

  it('logs the errors it answers with 500, without the request’s details', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { app: server } = await testServer();
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
