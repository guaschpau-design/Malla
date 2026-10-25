import 'fake-indexeddb/auto';

import type { ServerInfo } from '@teselia/protocol';
import { describe, expect, it } from 'vitest';

import { openAppDb } from '../storage/app-db.ts';
import { proposedServer, relayOrder, serverInfo } from './relays.ts';

const SERVER = 'https://teselia.example/';
const POST = 'https://post.teselia.example/';
const info = (fields: Partial<ServerInfo> = {}): ServerInfo => ({
  protocolVersion: 1,
  upstream: null,
  commandPost: null,
  ...fields,
});

describe('relay order', () => {
  it('uses only the group’s server when it has no command post', () => {
    expect(relayOrder('https://teselia.example', info(), null)).toEqual([SERVER]);
  });

  it('falls back to the command post the server announced', () => {
    expect(relayOrder(SERVER, info({ commandPost: POST }), null)).toEqual([SERVER, POST]);
  });

  it('prefers the command post the app was loaded from when it replicates the group’s server', () => {
    const home = { url: POST, info: info({ upstream: SERVER }) };
    expect(relayOrder(SERVER, info({ commandPost: POST }), home)).toEqual([POST, SERVER]);
  });

  it('ignores the app’s server when it replicates another server', () => {
    const home = { url: POST, info: info({ upstream: 'https://other.example/' }) };
    expect(relayOrder(SERVER, null, home)).toEqual([SERVER]);
  });
});

describe('server information', () => {
  it('remembers what a server said and uses it when the server cannot be reached', async () => {
    const db = await openAppDb('server-info-test');
    const online = () =>
      Promise.resolve(
        new Response(JSON.stringify({ status: 'ok', protocolVersion: 1, commandPost: POST })),
      );
    const offline = () => Promise.reject(new TypeError('Failed to fetch'));
    expect(await serverInfo(db, SERVER, online)).toEqual(info({ commandPost: POST }));
    expect(await serverInfo(db, 'https://teselia.example', offline)).toEqual(
      info({ commandPost: POST }),
    );
    expect(await serverInfo(db, 'https://unknown.example/', offline)).toBeNull();
  });

  it('proposes the upstream of a command post for new groups', async () => {
    const answer = (body: object) => () => Promise.resolve(new Response(JSON.stringify(body)));
    const post = answer({ status: 'ok', protocolVersion: 1, upstream: SERVER });
    const plain = answer({ status: 'ok', protocolVersion: 1 });
    expect(await proposedServer(POST, post)).toBe(SERVER);
    expect(await proposedServer(SERVER, plain)).toBe(SERVER);
    expect(await proposedServer(null, plain)).toBeNull();
  });
});
