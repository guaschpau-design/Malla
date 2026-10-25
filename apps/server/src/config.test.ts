import { describe, expect, it } from 'vitest';

import { readConfig } from './config.ts';

describe('configuration', () => {
  it('has defaults that work for a single server', () => {
    expect(readConfig({})).toEqual({
      host: '0.0.0.0',
      port: 8080,
      databasePath: 'data/teselia.db',
      retentionDays: 30,
      webRoot: null,
      upstream: null,
      commandPost: null,
    });
  });

  it('reads the command post settings as server base URLs', () => {
    const config = readConfig({
      TESELIA_UPSTREAM: 'https://teselia.example',
      TESELIA_COMMAND_POST: 'https://post.teselia.example/',
    });
    expect(config.upstream).toBe('https://teselia.example/');
    expect(config.commandPost).toBe('https://post.teselia.example/');
    expect(() => readConfig({ TESELIA_UPSTREAM: 'http://teselia.example' })).toThrow(
      /TESELIA_UPSTREAM/,
    );
  });

  it('rejects an invalid port or retention', () => {
    expect(() => readConfig({ TESELIA_PORT: 'eighty' })).toThrow(/TESELIA_PORT/);
    expect(() => readConfig({ TESELIA_RETENTION_DAYS: '0' })).toThrow(/TESELIA_RETENTION_DAYS/);
  });
});
