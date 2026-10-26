// Server configuration, read once from the environment.

import { isSecureUrl, serverBaseUrl } from '@tesel/protocol';

export interface ServerConfig {
  readonly host: string;
  readonly port: number;
  /** SQLite database file. */
  readonly databasePath: string;
  /** Envelopes older than this are deleted. */
  readonly retentionDays: number;
  /** Directory with the landing page and the built web app under app/, or null to serve none. */
  readonly webRoot: string | null;
  /** On a command post, the server it replicates (protocol §8.2). */
  readonly upstream: string | null;
  /** On an internet server, the base URL shared by its command posts (protocol §8.3). */
  readonly commandPost: string | null;
}

export function readConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  return {
    host: env['TESEL_HOST'] ?? '0.0.0.0',
    port: integer(env, 'TESEL_PORT', 8080, 1, 65535),
    databasePath: env['TESEL_DB'] ?? 'data/tesel.db',
    retentionDays: integer(env, 'TESEL_RETENTION_DAYS', 30, 1, 3650),
    webRoot: env['TESEL_WEB_ROOT'] || null,
    upstream: serverUrl(env, 'TESEL_UPSTREAM'),
    commandPost: serverUrl(env, 'TESEL_COMMAND_POST'),
  };
}

function serverUrl(env: NodeJS.ProcessEnv, name: string): string | null {
  const text = env[name];
  if (text === undefined || text === '') return null;
  if (!isSecureUrl(text)) throw new Error(`${name} must be an https URL, got "${text}"`);
  return serverBaseUrl(text);
}

function integer(
  env: NodeJS.ProcessEnv,
  name: string,
  fallback: number,
  min: number,
  max: number,
): number {
  const text = env[name];
  if (text === undefined || text === '') return fallback;
  const value = Number(text);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${name} must be an integer from ${min} to ${max}, got "${text}"`);
  }
  return value;
}
