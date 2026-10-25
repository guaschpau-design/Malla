import { describe, expect, it } from 'vitest';

import { readConfig } from './config.ts';

describe('configuration', () => {
  it('defaults to port 8080 on all interfaces', () => {
    expect(readConfig({})).toEqual({ host: '0.0.0.0', port: 8080 });
  });

  it('rejects an invalid port', () => {
    expect(() => readConfig({ MALLA_PORT: 'eighty' })).toThrow(/MALLA_PORT/);
  });
});
