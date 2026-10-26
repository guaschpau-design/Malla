import { describe, expect, it } from 'vitest';

import { readConfig } from './config.ts';

describe('configuration', () => {
  it('has defaults that work for a single server', () => {
    expect(readConfig({})).toEqual({
      host: '0.0.0.0',
      port: 8080,
      databasePath: 'data/tesel.db',
      retentionDays: 30,
      webRoot: null,
      upstream: null,
      commandPost: null,
      weatherCountries: ['ES', 'PT'],
    });
  });

  it('reads the countries whose weather warnings it gathers', () => {
    expect(readConfig({ TESEL_WEATHER: 'es' }).weatherCountries).toEqual(['ES']);
    expect(readConfig({ TESEL_WEATHER: 'off' }).weatherCountries).toEqual([]);
    expect(() => readConfig({ TESEL_WEATHER: 'ES,XX' })).toThrow(/TESEL_WEATHER/);
  });

  it('reads the command post settings as server base URLs', () => {
    const config = readConfig({
      TESEL_UPSTREAM: 'https://tesel.example',
      TESEL_COMMAND_POST: 'https://post.tesel.example/',
    });
    expect(config.upstream).toBe('https://tesel.example/');
    expect(config.commandPost).toBe('https://post.tesel.example/');
    expect(() => readConfig({ TESEL_UPSTREAM: 'http://tesel.example' })).toThrow(/TESEL_UPSTREAM/);
  });

  it('rejects an invalid port or retention', () => {
    expect(() => readConfig({ TESEL_PORT: 'eighty' })).toThrow(/TESEL_PORT/);
    expect(() => readConfig({ TESEL_RETENTION_DAYS: '0' })).toThrow(/TESEL_RETENTION_DAYS/);
  });
});
