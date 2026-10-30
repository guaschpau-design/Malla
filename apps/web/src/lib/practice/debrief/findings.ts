// What a situation tells of how an exercise went (Exercise.findings): figures, and words on what
// went well or could go better. The report at the end (debrief.ts) puts them first.

/** One figure of the report: what it counts, and how it came out. */
export interface Figure {
  readonly label: string;
  readonly value: string;
}

/** A word on something the user, or the team, did well or could do better. */
export interface Note {
  readonly good: boolean;
  readonly text: string;
}

export interface Findings {
  readonly figures: readonly Figure[];
  readonly notes: readonly Note[];
}
