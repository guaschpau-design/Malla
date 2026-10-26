// Which relays a group syncs through, in order (protocol §8.3): the server the app came from when
// it is a command post of the group's server, the group's server, and that server's command post.
// What servers say about themselves is remembered, so the order holds with no internet.

import {
  parseServerInfo,
  sameServer,
  serverBaseUrl,
  serverInfoUrl,
  type ServerInfo,
} from '@tesel/protocol';

import type { AppDb } from '../storage/app-db.ts';

/** How long to wait for a server to describe itself before using what it said last time. */
const INFO_TIMEOUT_MS = 4000;

/** The relays to try for a group whose server is `server`, best first. */
export function relayOrder(
  server: string,
  serverInfo: ServerInfo | null,
  home: { readonly url: string; readonly info: ServerInfo | null } | null,
): string[] {
  const relays: string[] = [];
  const add = (url: string | null | undefined) => {
    if (url && !relays.some((known) => sameServer(known, url))) relays.push(serverBaseUrl(url));
  };
  if (home?.info?.upstream && sameServer(home.info.upstream, server)) add(home.url);
  add(server);
  add(serverInfo?.commandPost);
  return relays;
}

/** What a server says about itself now, or null if it cannot be reached. */
export async function fetchServerInfo(
  server: string,
  fetchFn: typeof fetch = fetch,
): Promise<ServerInfo | null> {
  try {
    const response = await fetchFn(serverInfoUrl(server), {
      signal: AbortSignal.timeout(INFO_TIMEOUT_MS),
      cache: 'no-store',
    });
    return response.ok ? parseServerInfo(await response.text()) : null;
  } catch {
    return null;
  }
}

/** What a server says about itself now, or what it said last time if it cannot be reached. */
export async function serverInfo(
  db: AppDb,
  server: string,
  fetchFn: typeof fetch = fetch,
): Promise<ServerInfo | null> {
  const key = serverBaseUrl(server);
  const info = await fetchServerInfo(key, fetchFn);
  if (info === null) return (await db.get('servers', key)) ?? null;
  await db.put('servers', info, key);
  return info;
}

/**
 * The server to propose for a new group: the app's own server or, when that is a command post,
 * the server it replicates, so the group lives on beyond the post.
 */
export async function proposedServer(
  homeServer: string | null,
  fetchFn: typeof fetch = fetch,
): Promise<string | null> {
  if (homeServer === null) return null;
  return (await fetchServerInfo(homeServer, fetchFn))?.upstream ?? homeServer;
}

/** The relays for a group, asking its server and the app's own server about themselves. */
export async function relaysFor(
  db: AppDb,
  server: string,
  homeServer: string | null,
): Promise<string[]> {
  const [info, homeInfo] = await Promise.all([
    serverInfo(db, server),
    homeServer === null || sameServer(homeServer, server) ? null : serverInfo(db, homeServer),
  ]);
  return relayOrder(server, info, homeServer === null ? null : { url: homeServer, info: homeInfo });
}
