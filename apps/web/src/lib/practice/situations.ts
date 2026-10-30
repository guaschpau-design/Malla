// The situations a practice can play, each an exercise round where the user is, or where the map is
// for the mountain, with the user as a member of the team or as its coordinator (ADR-0066,
// ADR-0072).

import type { MessageKey } from '../i18n/index.ts';
import type { GlyphName } from '../ui/glyphs.ts';
import type { Exercise, Setting } from './exercise.ts';
import { flood } from './scenes/flood.ts';
import { missingPerson } from './scenes/missing-person.ts';
import { mountain, suitsMountain } from './scenes/mountain.ts';
import { race } from './scenes/race.ts';
import { wildfire } from './scenes/wildfire.ts';

export const SITUATIONS = ['missing-person', 'flood', 'wildfire', 'race', 'mountain'] as const;
export type Situation = (typeof SITUATIONS)[number];

interface SituationInfo {
  /** Its name, as the practice's choices show it. */
  readonly title: MessageKey;
  readonly icon: GlyphName;
  readonly exercise: (setting: Setting) => Exercise;
  /** Whether it has a search area, which a coordinator sweeps (the practice guide's last step). */
  readonly search: boolean;
  /** Whether it needs the lie of the land, which water follows and paths climb. */
  readonly heights: boolean;
  /**
   * Where it is played: round the user, where they are (or, without a position, where the map is),
   * or where the map is, which the user moves to a place fit for it.
   */
  readonly place: 'here' | 'map';
  /** Whether the place read round where it is played is fit for it; any place is, without. */
  readonly suits?: (setting: Pick<Setting, 'ground' | 'centre'>) => boolean;
}

export const SITUATION_INFO: Readonly<Record<Situation, SituationInfo>> = {
  'missing-person': {
    title: 'practiceMissingPersonTitle',
    icon: 'search',
    exercise: missingPerson,
    search: true,
    heights: false,
    place: 'here',
  },
  flood: {
    title: 'practiceFloodTitle',
    icon: 'waves',
    exercise: flood,
    search: false,
    heights: true,
    place: 'here',
  },
  wildfire: {
    title: 'practiceWildfireTitle',
    icon: 'flame',
    exercise: wildfire,
    search: false,
    heights: false,
    place: 'here',
  },
  race: {
    title: 'practiceRaceTitle',
    icon: 'flag',
    exercise: race,
    search: false,
    heights: false,
    place: 'here',
  },
  mountain: {
    title: 'practiceMountainTitle',
    icon: 'relief',
    exercise: mountain,
    search: false,
    heights: true,
    place: 'map',
    suits: suitsMountain,
  },
};
