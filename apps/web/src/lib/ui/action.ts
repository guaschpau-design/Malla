// Something that can be done with what a panel shows, as ui/Actions.svelte lists it.

import type { GlyphName } from './glyphs.ts';

export interface Action {
  readonly icon: GlyphName;
  readonly label: string;
  readonly run: () => void;
}
