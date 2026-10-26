// What the user can show or hide on the map. This device and SOS calls are always shown.

export const MAP_LAYERS = ['members', 'trails', 'objects', 'tasks', 'services', 'weather'] as const;
export type MapLayer = (typeof MAP_LAYERS)[number];
