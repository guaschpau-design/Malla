// The situations a practice can play, each a scenario around where the user is, with the user as a
// member of the team or as its coordinator (ADR-0066).

import type { LatLon, Role } from '@tesel/protocol';
import type { Scenario } from '@tesel/scenario';

import type { MessageKey, Translate } from '../i18n/index.ts';
import type { GlyphName } from '../ui/glyphs.ts';
import { flood } from './scenes/flood.ts';
import { missingPerson } from './scenes/missing-person.ts';
import { wildfire } from './scenes/wildfire.ts';

export const SITUATIONS = ['missing-person', 'flood', 'wildfire'] as const;
export type Situation = (typeof SITUATIONS)[number];

interface SituationInfo {
  /** Its name, as the practice's choices show it. */
  readonly title: MessageKey;
  readonly icon: GlyphName;
  readonly scenario: (t: Translate, centre: LatLon, user: Role) => Scenario;
  /** Whether it has a search area, which a coordinator sweeps (the practice guide's last step). */
  readonly search: boolean;
}

export const SITUATION_INFO: Readonly<Record<Situation, SituationInfo>> = {
  'missing-person': {
    title: 'practiceMissingPersonTitle',
    icon: 'search',
    scenario: missingPerson,
    search: true,
  },
  flood: { title: 'practiceFloodTitle', icon: 'waves', scenario: flood, search: false },
  wildfire: { title: 'practiceWildfireTitle', icon: 'flame', scenario: wildfire, search: false },
};
