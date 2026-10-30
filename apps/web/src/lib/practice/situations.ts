// The situations a practice can play, each an exercise around where the user is, with the user as a
// member of the team or as its coordinator (ADR-0066, ADR-0072).

import type { MessageKey } from '../i18n/index.ts';
import type { GlyphName } from '../ui/glyphs.ts';
import type { Exercise, Setting } from './exercise.ts';
import { flood } from './scenes/flood.ts';
import { missingPerson } from './scenes/missing-person.ts';
import { race } from './scenes/race.ts';
import { wildfire } from './scenes/wildfire.ts';

export const SITUATIONS = ['missing-person', 'flood', 'wildfire', 'race'] as const;
export type Situation = (typeof SITUATIONS)[number];

interface SituationInfo {
  /** Its name, as the practice's choices show it. */
  readonly title: MessageKey;
  readonly icon: GlyphName;
  readonly exercise: (setting: Setting) => Exercise;
  /** Whether it has a search area, which a coordinator sweeps (the practice guide's last step). */
  readonly search: boolean;
  /** Whether it needs the lie of the land, which water follows. */
  readonly heights: boolean;
}

export const SITUATION_INFO: Readonly<Record<Situation, SituationInfo>> = {
  'missing-person': {
    title: 'practiceMissingPersonTitle',
    icon: 'search',
    exercise: missingPerson,
    search: true,
    heights: false,
  },
  flood: {
    title: 'practiceFloodTitle',
    icon: 'waves',
    exercise: flood,
    search: false,
    heights: true,
  },
  wildfire: {
    title: 'practiceWildfireTitle',
    icon: 'flame',
    exercise: wildfire,
    search: false,
    heights: false,
  },
  race: {
    title: 'practiceRaceTitle',
    icon: 'flag',
    exercise: race,
    search: false,
    heights: false,
  },
};
