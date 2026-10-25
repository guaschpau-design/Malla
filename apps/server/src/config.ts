// Server configuration, read once from the environment.

export interface ServerConfig {
  readonly host: string;
  readonly port: number;
  /** SQLite database file. */
  readonly databasePath: string;
  /** Envelopes older than this are deleted. */
  readonly retentionDays: number;
}

export function readConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  return {
    host: env['TESELIA_HOST'] ?? '0.0.0.0',
    port: integer(env, 'TESELIA_PORT', 8080, 1, 65535),
    databasePath: env['TESELIA_DB'] ?? 'data/teselia.db',
    retentionDays: integer(env, 'TESELIA_RETENTION_DAYS', 30, 1, 3650),
  };
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
