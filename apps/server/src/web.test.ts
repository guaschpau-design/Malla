import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { buildApp } from './app.ts';
import { EnvelopeStore } from './envelope-store.ts';
import { Relay } from './relay.ts';

function site(): string {
  const root = mkdtempSync(join(tmpdir(), 'tesel-web-'));
  mkdirSync(join(root, 'app', 'assets'), { recursive: true });
  writeFileSync(join(root, 'index.html'), '<h1>Tesel</h1>');
  writeFileSync(join(root, 'app', 'index.html'), '<div id="app"></div>');
  writeFileSync(join(root, 'app', 'assets', 'main-abc123.js'), 'console.log(1)');
  return root;
}

const app = () =>
  buildApp(new Relay(new EnvelopeStore(':memory:'), Date.now), {
    webRoot: site(),
    upstream: null,
    commandPost: null,
  });

describe('web serving', () => {
  it('serves the landing page at the root and the app under /app/', async () => {
    const server = await app();
    expect((await server.inject('/')).body).toContain('Tesel');
    const appPage = await server.inject('/app/');
    expect(appPage.body).toContain('id="app"');
    expect(appPage.headers['cache-control']).toBe('no-cache');
    await server.close();
  });

  it('answers the invitation path and other app paths with the app', async () => {
    const server = await app();
    const join = await server.inject('/app/join');
    expect(join.statusCode).toBe(200);
    expect(join.body).toContain('id="app"');
    expect((await server.inject('/elsewhere')).statusCode).toBe(404);
    expect((await server.inject('/app/map-assets/fonts/45.pbf')).statusCode).toBe(404);
    await server.close();
  });

  it('adds the missing slash to folder paths', async () => {
    const server = await app();
    const redirect = await server.inject('/app?lang=es');
    expect(redirect.statusCode).toBe(301);
    expect(redirect.headers.location).toBe('/app/');
    expect((await server.inject('/../../etc')).statusCode).toBe(404);
    await server.close();
  });

  it('lets browsers keep hashed assets for good', async () => {
    const server = await app();
    const asset = await server.inject('/app/assets/main-abc123.js');
    expect(asset.headers['cache-control']).toBe('public, max-age=31536000, immutable');
    await server.close();
  });
});
