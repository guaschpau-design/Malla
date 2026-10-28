import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

import { CONTENT_SECURITY_POLICY } from './content-security-policy.ts';

const HEADERS = new URL('../../../deploy/vps/headers.caddy', import.meta.url);

describe("the app's Content-Security-Policy", () => {
  it('is the same in its page and in the header its servers send, which adds frame-ancestors', async () => {
    const caddy = await readFile(HEADERS, 'utf8');
    const header = /header @app \{\s*Content-Security-Policy "([^"]+)"/.exec(caddy)?.[1];
    expect(header).toBe(`${CONTENT_SECURITY_POLICY}; frame-ancestors 'none'`);
  });
});
