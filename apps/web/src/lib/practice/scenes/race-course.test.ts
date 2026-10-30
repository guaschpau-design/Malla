import { distanceMeters, offsetMeters } from '@tesel/core';
import { describe, expect, it } from 'vitest';

import { Ground } from '../ground.ts';
import { RaceCourse, START_S } from './race-course.ts';

const HERE = { lat: 39.4699, lon: -0.3763 };
const at = (north: number, east: number) => offsetMeters(HERE, north, east);

/** Streets every 100 m for 700 m round here, named "Calle" east–west and "Avenida" north–south. */
function town(): Ground {
  const steps = Array.from({ length: 15 }, (_, index) => -700 + index * 100);
  const ways = steps.flatMap((offset, index) => [
    { points: steps.map((east) => at(offset, east)), name: `Calle ${String(index + 1)}` },
    { points: steps.map((north) => at(north, offset)), name: `Avenida ${String(index + 1)}` },
  ]);
  return new Ground({ ways, waterways: [], greens: [] }, null, 'es');
}

describe('a race course', () => {
  const meeting = at(-60, -80);
  const course = new RaceCourse(town(), HERE, meeting);

  it('goes round the streets from beside the meeting point, back to it, about five kilometres', () => {
    expect(course.loop[0]).toEqual(course.loop.at(-1));
    expect(distanceMeters(course.start, meeting)).toBeLessThan(400);
    expect(course.length).toBeGreaterThan(4000);
    expect(course.length).toBeLessThan(6500);
  });

  it('closes four crossings of named streets, in order round the loop', () => {
    expect(course.crossings.map((crossing) => crossing.number)).toEqual([1, 2, 3, 4]);
    const along = course.crossings.map((crossing) => crossing.along);
    expect(along).toEqual([...along].sort((a, b) => a - b));
    for (const crossing of course.crossings) {
      expect(crossing.streets?.some((street) => street.startsWith('Calle'))).toBe(true);
      expect(crossing.streets?.some((street) => street.startsWith('Avenida'))).toBe(true);
    }
  });

  it('has runners passing a point only between the leaders and the last of them', () => {
    const [first] = course.crossings;
    if (first === undefined) throw new Error('no crossing');
    expect(course.passing(first.along, START_S)).toBe(false);
    const leaders = course.headPasses(first.along);
    expect(course.passing(first.along, leaders - 5)).toBe(false);
    expect(course.passing(first.along, leaders + 5)).toBe(true);
    expect(course.winnerIn).toBeLessThan(25 * 60);
  });
});
