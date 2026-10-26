// The button that shows this device on the map. Off: the GPS is not used for the map. Follow: the
// map stays centred on the device. Show: the device is drawn but the user has moved the map away.

export type FollowMode = 'off' | 'follow' | 'show';

/** What pressing the button does. */
export function afterPress(mode: FollowMode): FollowMode {
  return mode === 'follow' ? 'off' : 'follow';
}

/** Moving the map by hand stops following, but keeps the device on the map. */
export function afterPan(mode: FollowMode): FollowMode {
  return mode === 'follow' ? 'show' : mode;
}
