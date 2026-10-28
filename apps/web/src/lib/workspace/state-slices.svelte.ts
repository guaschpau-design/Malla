// The group's state, slice by slice, for what draws it on the map. The reducer keeps every slice an
// event does not change (ARCHITECTURE.md §3.4), but the state as a whole is new after every event:
// a layer that reads one slice through it would redraw on every position. Here each slice is a
// reactive value of its own, changed only when the reducer made a new one.

import { EMPTY_STATE, type GroupState } from '@tesel/core';

type SliceName = keyof GroupState;

/** The slices of `state`, each read reactively and changed only when it is a new one. */
export function stateSlices(state: () => GroupState): GroupState {
  const slices: Partial<Record<SliceName, unknown>> = {};
  for (const name of Object.keys(EMPTY_STATE) as SliceName[]) {
    const slice = $derived(state()[name]);
    Object.defineProperty(slices, name, { get: () => slice, enumerable: true });
  }
  return slices as GroupState;
}
