// Plays a scenario on a group, for a demonstration or to try the app with company:
//
//   pnpm --filter @tesel/simulator start '<invitation link>' [--scenario turia]
//     [--speed 1 | --speed instant] [--positions 10]
//
// The invitation link is the one the app shows under Groups → Invite; it carries the group and
// its server. With --speed instant the scenario is sent at once, as if it had already happened.

import { parseArgs } from 'node:util';

import { parseInvitationUrl } from '@tesel/protocol';

import { play } from './play.ts';
import { SCENARIOS } from './scenarios/index.ts';

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    scenario: { type: 'string', default: 'turia' },
    speed: { type: 'string', default: '1' },
    positions: { type: 'string', default: '10' },
  },
});

const link = positionals[0];
if (link === undefined) fail('give the invitation link of the group to play on.');
const invitation = parseInvitationUrl(link);
if (!invitation.ok) fail(`that is not an invitation link (${invitation.error.detail}).`);
if (invitation.value.server === null) fail('the group has no server to play on.');
const scenario = SCENARIOS.get(values.scenario);
if (scenario === undefined)
  fail(`no scenario "${values.scenario}"; try: ${[...SCENARIOS.keys()].join(', ')}.`);
const speed = values.speed === 'instant' ? Infinity : Number(values.speed);
const positionEvery = Number(values.positions);
if (!(speed > 0) || !(positionEvery > 0)) fail('--speed and --positions must be positive.');

say(`Playing "${scenario.name}" on ${invitation.value.groupName}: ${scenario.description}`);
await play(scenario, {
  server: invitation.value.server,
  secret: invitation.value.secret,
  speed,
  positionEvery,
  log: say,
});
say('Done.');

function say(line: string): void {
  process.stdout.write(`${line}\n`);
}

function fail(message: string): never {
  console.error(`Error: ${message}`);
  process.exit(1);
}
