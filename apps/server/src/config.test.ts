import { describe, expect, it } from 'vitest';

import { readConfig } from './config.ts';

describe('configuration', () => {
  it('has defaults that work for a single server', () => {
    expect(readConfig({})).toEqual({
      host: '0.0.0.0',
      port: 8080,
      databasePath: 'data/malla.db',
      retentionDays: 30,
    });
  });

  it('rejects an invalid port or retention', () => {
    expect(() => readConfig({ MALLA_PORT: 'eighty' })).toThrow(/MALLA_PORT/);
    expect(() => readConfig({ MALLA_RETENTION_DAYS: '0' })).toThrow(/MALLA_RETENTION_DAYS/);
  });
});
