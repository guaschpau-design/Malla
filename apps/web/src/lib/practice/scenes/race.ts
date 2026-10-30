// A popular race of about five kilometres round the streets of the place (race-course.ts), with
// the team in charge of keeping it safe (race-world.ts). The race's control draws the course and
// marks its start and finish, the medical post, the aid station and the four crossings to close;
// the race starts six minutes in. With the user as a member, Carmen sends one of the team to each
// crossing (the user to the second, to tell when the leaders pass), the nurses to the medical post
// and Luis to the aid station; with the user as coordinator, all that is theirs to decide, before
// the start.

import { simplifyLine } from '@tesel/core';
import { SHAPE_MAX_POINTS, ShapeStyleCode, SymbolCode } from '@tesel/protocol';
import { YOU, type ScenarioStep } from '@tesel/scenario';

import { roundArea } from '../coverage.ts';
import type { Exercise, Inject, Setting } from '../exercise.ts';
import {
  CARMEN,
  cast,
  EXERCISE_SECONDS,
  introductions,
  JORDI,
  LUIS,
  MARTA,
  meetingPoint,
  NURIA,
  PABLO,
  personas,
  placeAround,
  SARA,
  sosToPractise,
  step,
} from './cast.ts';
import { raceFindings } from './race-findings.ts';
import { START_S } from './race-course.ts';
import { AID_STATION } from './race-mishaps.ts';
import { raceControl, RaceWorld } from './race-world.ts';

/** Ids of the race's objects, for tasks to refer to. */
const COURSE = 'course';
const START = 'start-finish';
const MEDICAL_POST = 'medical-post';
/** How far before the finish line the medical post stands. */
const MEDICAL_BEFORE_M = 40;
/** How many runners there are. */
const RUNNERS = 600;

export function race(setting: Setting): Exercise {
  const { t, centre, user } = setting;
  const at = placeAround(centre);
  const world = new RaceWorld(setting, at);
  const { course } = world;
  const control = raceControl(t);
  const people = personas({
    [CARMEN]: { profile: 'civil-protection', equipment: ['radio', 'vehicle', 'lora'] },
    [JORDI]: { profile: 'volunteer', equipment: ['radio', 'light'] },
    [LUIS]: { profile: 'volunteer', equipment: ['radio', 'defibrillator'] },
    [MARTA]: { profile: 'medical', equipment: ['first-aid', 'stretcher'] },
    [NURIA]: { profile: 'volunteer', equipment: ['radio', 'light', 'lora'] },
    [PABLO]: { profile: 'volunteer', equipment: ['vehicle', 'water'] },
    [SARA]: { profile: 'medical', equipment: ['first-aid', 'defibrillator'] },
  });
  const about = {
    distance: Math.round(course.length / 100) / 10,
    laps: course.laps,
    runners: RUNNERS,
    minutes: Math.round(START_S / 60),
  };
  const briefing: ScenarioStep[] =
    user === 'member'
      ? [step(3, CARMEN, { type: 'chat', text: t('practiceRaceArrived', about) })]
      : [
          step(3, control, { type: 'chat', text: t('practiceRaceCall', about) }),
          step(30, control, { type: 'chat', text: t('practiceRacePlan') }),
        ];
  const marker = (
    id: string,
    symbol: number,
    label: string,
    where: { lat: number; lon: number },
  ): ScenarioStep => step(10, control, { type: 'marker', id, symbol, label, where });
  return {
    scenario: {
      name: 'race',
      description: t('practiceRace', about),
      center: centre,
      duration: EXERCISE_SECONDS,
      members: cast(t, at, user, control),
      steps: [
        ...introductions(people),
        ...briefing,
        meetingPoint(t, at, 'practiceMeetingPoint'),
        step(8, control, {
          type: 'shape',
          id: COURSE,
          style: ShapeStyleCode.ROUTE,
          label: t('practiceRaceCourse'),
          geometry: {
            kind: 'polyline',
            points: simplifyLine(course.loop, SHAPE_MAX_POINTS).points,
          },
        }),
        marker(START, SymbolCode.COMMAND_POST, t('practiceRaceStart'), course.start),
        marker(
          MEDICAL_POST,
          SymbolCode.MEDICAL_POST,
          t('practiceRaceMedicalPost'),
          course.pointAt(course.lap - MEDICAL_BEFORE_M),
        ),
        marker(AID_STATION, SymbolCode.WATER, t('practiceRaceAidStation'), world.aidStation),
        ...course.crossings.map((crossing) =>
          marker(
            crossing.id,
            SymbolCode.BLOCKED_ROAD,
            t('practiceRaceCrossingLabel', { number: crossing.number }),
            crossing.at,
          ),
        ),
      ],
    },
    personas: people,
    world,
    injects: [
      ...countdown(control),
      ...(user === 'member' ? carmensOrders(world) : []),
      sosToPractise(t, 600, { kind: 'medical', text: 'practiceRaceSos' }),
    ],
    outages: [
      {
        from: START_S,
        to: Infinity,
        area: roundArea(centre, 650),
        kind: 'busy',
        says: 'practiceRaceBusy',
      },
    ],
    findings: raceFindings(world),
    seconds: EXERCISE_SECONDS,
  };
}

/** The control's countdown to the start, and the heat as the morning goes on. */
function countdown(control: string): Inject[] {
  return [
    {
      at: START_S - 120,
      run: (stage) => {
        stage.say(control, stage.t('practiceRaceTwoMinutes'));
      },
    },
    {
      at: START_S,
      run: (stage) => {
        stage.say(control, stage.t('practiceRaceStarted', { runners: RUNNERS }));
      },
    },
    {
      at: 960,
      run: (stage) => {
        stage.say(control, stage.t('practiceRaceHeat'));
      },
    },
  ];
}

/**
 * When the user is a member: Carmen sends Jordi, the user, Nuria and Pablo to the four crossings,
 * Luis to the aid station and the nurses to the medical post, and asks to be told when the
 * leaders pass.
 */
function carmensOrders(world: RaceWorld): Inject[] {
  const marshals = [JORDI, YOU, NURIA, PABLO];
  return [
    {
      at: 40,
      run: (stage) => {
        world.course.crossings.forEach((crossing, index) => {
          const assignee = marshals[index] ?? PABLO;
          if (assignee === YOU) world.postUser(crossing.id);
          stage.act(CARMEN, {
            type: 'task',
            id: `guard-${crossing.id}`,
            text: stage.t('practiceRaceGuard', {
              number: crossing.number,
              crossing: world.crossingName(stage.t, crossing),
            }),
            assignee,
            place: { kind: 'object', id: crossing.id },
          });
        });
        const post = (id: string, text: 'practiceRaceStaffAid' | 'practiceRaceStaffMedical') =>
          ({ type: 'task', text: stage.t(text), place: { kind: 'object', id } }) as const;
        stage.act(CARMEN, {
          ...post(AID_STATION, 'practiceRaceStaffAid'),
          id: 'aid',
          assignee: LUIS,
        });
        stage.act(CARMEN, {
          ...post(MEDICAL_POST, 'practiceRaceStaffMedical'),
          id: 'medical-marta',
          assignee: MARTA,
        });
        stage.act(CARMEN, {
          ...post(MEDICAL_POST, 'practiceRaceStaffMedical'),
          id: 'medical-sara',
          assignee: SARA,
        });
        const [, yours] = world.course.crossings;
        stage.say(
          CARMEN,
          stage.t('practiceRaceOrders', {
            name: stage.user.name,
            number: yours?.number ?? 2,
          }),
        );
      },
    },
  ];
}
