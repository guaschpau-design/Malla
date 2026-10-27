// Reads JSON documents from the network or the disk with a size limit, so a broken or hostile
// source cannot fill the server's memory.

import { readFile, stat } from 'node:fs/promises';

const REQUEST_TIMEOUT_MS = 60_000;

/** Reads a JSON document from `url`; fails if it is longer than `maxBytes`. */
export async function getJson(url: string, maxBytes: number): Promise<unknown> {
  const response = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  if (!response.ok) throw new Error(`${url} answered ${String(response.status)}`);
  if (response.body === null) throw new Error(`${url} answered with no document`);
  // Node's types leave the chunks untyped; fetch delivers them as bytes.
  const body = response.body as AsyncIterable<Uint8Array>;
  const chunks: Uint8Array[] = [];
  let size = 0;
  // Leaving the loop early cancels the download.
  for await (const chunk of body) {
    size += chunk.byteLength;
    if (size > maxBytes) throw new Error(`${url} is larger than ${String(maxBytes)} bytes`);
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

/** Reads a JSON file; fails if it is longer than `maxBytes`. */
export async function readJsonFile(path: string, maxBytes: number): Promise<unknown> {
  const { size } = await stat(path);
  if (size > maxBytes) throw new Error(`${path} is larger than ${String(maxBytes)} bytes`);
  return JSON.parse(await readFile(path, 'utf8'));
}
