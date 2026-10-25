// Server configuration, read once from the environment.

export interface ServerConfig {
  readonly host: string;
  readonly port: number;
}

export function readConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  const port = Number(env['MALLA_PORT'] ?? 8080);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`MALLA_PORT must be a TCP port, got ${env['MALLA_PORT'] ?? ''}`);
  }
  return { host: env['MALLA_HOST'] ?? '0.0.0.0', port };
}
