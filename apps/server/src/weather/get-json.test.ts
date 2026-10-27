import { mkdtempSync, writeFileSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { getJson, readJsonFile } from './get-json.ts';

const DOCUMENT = { warnings: ['x'.repeat(1000)] };
let server: Server | null = null;

/** Serves DOCUMENT, without saying how long it is, so only reading it tells. */
async function serveDocument(): Promise<string> {
  server = createServer((_request, response) => {
    response.writeHead(200, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify(DOCUMENT));
  });
  await new Promise<void>((resolve) => server?.listen(0, '127.0.0.1', resolve));
  return `http://127.0.0.1:${String((server.address() as AddressInfo).port)}/feed`;
}

afterEach(async () => {
  const running = server;
  server = null;
  if (running !== null) await new Promise((resolve) => running.close(resolve));
});

describe('reading JSON with a size limit', () => {
  it('reads a document within the limit', async () => {
    expect(await getJson(await serveDocument(), 10_000)).toEqual(DOCUMENT);
  });

  it('gives up on a download larger than the limit', async () => {
    await expect(getJson(await serveDocument(), 500)).rejects.toThrow(/larger than 500 bytes/);
  });

  it('refuses a file larger than the limit', async () => {
    const path = join(mkdtempSync(join(tmpdir(), 'tesel-json-')), 'regions.json');
    writeFileSync(path, JSON.stringify(DOCUMENT));
    expect(await readJsonFile(path, 10_000)).toEqual(DOCUMENT);
    await expect(readJsonFile(path, 500)).rejects.toThrow(/larger than 500 bytes/);
  });
});
