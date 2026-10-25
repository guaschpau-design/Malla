import { describe, expect, it } from 'vitest';

import { readConfig } from './config.ts';

describe('configuration', () => {
  it('has defaults that work for a single server', () => {
    expect(readConfig({})).toEqual({
      host: '0.0.0.0',
      port: 8080,
      databasePath: 'data/teselia.db',
      retentionDays: 30,
    });
  });

  it('rejects an invalid port or retention', () => {
    expect(() => readConfig({ TESELIA_PORT: 'eighty' })).toThrow(/TESELIA_PORT/);
    expect(() => readConfig({ TESELIA_RETENTION_DAYS: '0' })).toThrow(/TESELIA_RETENTION_DAYS/);
  });
});
