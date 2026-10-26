// How this device shares its position with the active group (briefing §4): sharing, paused
// (the group keeps the last position, now out of date) or hidden (the group stops seeing it).

export const POSITION_MODES = ['sharing', 'paused', 'hidden'] as const;
export type PositionMode = (typeof POSITION_MODES)[number];
