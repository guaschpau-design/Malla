import { EMPTY_STATE, reduce, type GroupState } from '@tesel/core';
import { generateIdentity, type NodeId, type Role, type TeselEvent } from '@tesel/protocol';
import { describe, expect, it } from 'vitest';

import { translator } from '../../i18n/index.ts';
import type { CoverageTally } from '../coverage.ts';
import { debriefOf } from './debrief.ts';
import type { Findings } from './findings.ts';
import { UserLog } from './user-log.ts';

const t = translator('es');
const user = generateIdentity().nodeId;
const jordi = generateIdentity().nodeId;

/** The header of an event by `origin`, number `seq`. */
const by = (origin: NodeId, seq: number) => ({ origin, seq, time: 1_800_000_000 + seq });

const jordiJoins: TeselEvent = {
  ...by(jordi, 1),
  type: 'member-info',
  role: 'member',
  publicKey: new Uint8Array(32),
  alias: 'Jordi',
};
const jordisSos: TeselEvent = {
  ...by(jordi, 2),
  type: 'sos',
  kind: 'medical',
  lat: 39.47,
  lon: -0.38,
  accuracy: null,
  text: 'Tobillo',
};
const answered: TeselEvent = { ...by(user, 1), type: 'ack', target: { origin: jordi, seq: 2 } };

/** An exercise where the network never failed. */
const FULL_COVERAGE: CoverageTally = {
  cut: 0,
  longestS: 0,
  stranded: 0,
  strandedWaitS: 0,
  reached: 0,
};

const stateOf = (events: readonly TeselEvent[]): GroupState => events.reduce(reduce, EMPTY_STATE);

/** The report of an exercise that lasted `elapsed` seconds and ended as `state`. */
function report(
  role: Role,
  state: GroupState,
  log: UserLog,
  elapsed = 1500,
  findings: Findings = { figures: [], notes: [] },
  coverage: CoverageTally = FULL_COVERAGE,
) {
  const ending = { t, state, user: { node: user, role, name: 'Ana' }, elapsed };
  return debriefOf(ending, log, findings, coverage);
}

describe('the report at the end of an exercise', () => {
  it('puts the situation first, then how quickly the user answered an SOS', () => {
    const log = new UserLog();
    log.look(stateOf([jordiJoins, jordisSos]), user, 300);
    log.look(stateOf([jordiJoins, jordisSos, answered]), user, 320);
    const findings = {
      figures: [{ label: 'Rosa', value: 'La encontró el equipo a los 19:30' }],
      notes: [{ good: true, text: 'El equipo encontró a Rosa.' }],
    };
    const { figures, good } = report('member', stateOf([answered]), log, 1500, findings);
    expect(figures.slice(0, 3)).toEqual([
      { label: 'Duración', value: '25:00' },
      { label: 'Rosa', value: 'La encontró el equipo a los 19:30' },
      { label: 'SOS atendidos', value: '1 de 1, en 20 s de media' },
    ]);
    expect(good).toEqual(['El equipo encontró a Rosa.', 'Atendiste los SOS enseguida.']);
  });

  it('tells a member what they left undone and that nobody heard from them', () => {
    const task: TeselEvent = {
      ...by(jordi, 3),
      type: 'task',
      task: { origin: jordi, seq: 3 },
      status: 'in-progress',
      assignee: user,
      place: null,
      text: 'Pregunta a los vecinos',
    };
    const { figures, better } = report('member', stateOf([task]), new UserLog());
    expect(figures).toContainEqual({ label: 'Tus tareas, hechas', value: '0 de 1' });
    expect(better).toEqual([
      t('debriefTaskLeft', { task: 'Pregunta a los vecinos' }),
      t('debriefNoReport'),
      t('debriefSilent'),
    ]);
  });

  it('tells a coordinator how late the first order came, and an SOS left unanswered', () => {
    const team: TeselEvent = {
      ...by(user, 2),
      type: 'team',
      team: generateIdentity().nodeId,
      colour: 'blue',
      dissolved: false,
      members: [jordi],
      name: 'Norte',
    };
    const log = new UserLog();
    log.look(stateOf([jordiJoins, jordisSos]), user, 100);
    log.look(stateOf([jordiJoins, jordisSos, team]), user, 250);
    const { figures, better } = report('coordinator', stateOf([jordiJoins, jordisSos, team]), log);
    expect(figures).toContainEqual({ label: 'Primera orden', value: '04:10' });
    expect(figures).toContainEqual({ label: 'SOS atendidos', value: '0 de 1' });
    expect(better.slice(0, 2)).toEqual([
      t('debriefSosMissed', { name: 'Jordi' }),
      t('debriefOrderedLate', { time: '04:10' }),
    ]);
  });

  it('tells a coordinator whose orders went to someone without coverage', () => {
    const coverage = { cut: 2, longestS: 300, stranded: 1, strandedWaitS: 240, reached: 0 };
    const { figures, better } = report(
      'coordinator',
      stateOf([]),
      new UserLog(),
      1500,
      undefined,
      coverage,
    );
    expect(figures).toContainEqual({ label: 'Sin cobertura ni radio', value: '2 · hasta 05:00' });
    expect(figures).toContainEqual({
      label: 'Tareas que no llegaban',
      value: '1 · esperaron 04:00 de media',
    });
    expect(better).toContain(t('debriefStrandedNote', { count: 1 }));
  });

  it('leaves out an SOS too recent to have been answered', () => {
    const log = new UserLog();
    log.look(stateOf([jordiJoins, jordisSos]), user, 1480);
    const { figures } = report('member', stateOf([jordiJoins, jordisSos]), log);
    expect(figures.map((figure) => figure.label)).not.toContain('SOS atendidos');
  });
});
