import type { NodeId, ReportEvent } from '@tesel/protocol';
import { describe, expect, it } from 'vitest';

import { translator } from '../i18n/index.ts';
import { addedUp, reportLine } from './report-summary.ts';

const ANA = 'a1b2c3d4' as NodeId;
const T0 = 1_761_350_400;
const t = translator('es');

const REPORT: ReportEvent = {
  type: 'report',
  origin: ANA,
  seq: 1,
  time: T0,
  place: null,
  incident: 'fire',
  hazards: ['smoke', 'gas'],
  access: 'blocked',
  casualties: { red: 1, yellow: null, green: 3, black: null },
  resources: ['ambulance'],
  note: 'Nave 3',
};

describe('report summaries', () => {
  it('tells in one line only what the report tells', () => {
    expect(reportLine(REPORT, t)).toBe(
      'Incendio · Víctimas — Rojo: 1, Verde: 3 · Acceso cortado · Peligros: Humo, Gas · Hace falta: Ambulancia · Nave 3',
    );
    const bare = {
      ...REPORT,
      hazards: [],
      access: 'unknown',
      casualties: { red: null, yellow: null, green: null, black: null },
      resources: [],
      note: '',
    } as const;
    expect(reportLine(bare, t)).toBe('Incendio');
  });

  it('adds up the casualties of several reports, leaving unknown what none told', () => {
    const other = { ...REPORT, casualties: { red: 2, yellow: null, green: null, black: 0 } };
    expect(addedUp([REPORT, other])).toEqual({ red: 3, yellow: null, green: 3, black: 0 });
  });
});
