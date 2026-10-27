// What the user can show or hide on the map, and how the layers panel groups it. This device and
// SOS calls are always shown.

import type { MessageKey } from '../i18n/index.ts';
import type { GlyphName } from '../ui/glyphs.ts';

/** Layers shown unless the user hides them; the hidden ones are a preference. */
export const MAP_LAYERS = ['members', 'trails', 'objects', 'tasks', 'services', 'weather'] as const;
export type MapLayer = (typeof MAP_LAYERS)[number];

/** Layers off unless the user turns them on, each a preference of its own. */
export const MAP_FLAGS = ['relief', 'grid', 'radar'] as const;
export type MapFlag = (typeof MAP_FLAGS)[number];

export type LayerSwitch = MapLayer | MapFlag;

export const LAYER_SWITCHES: Readonly<Record<LayerSwitch, { label: MessageKey; icon: GlyphName }>> =
  {
    members: { label: 'layerMembers', icon: 'person' },
    trails: { label: 'layerTrails', icon: 'trail' },
    objects: { label: 'layerObjects', icon: 'pin' },
    tasks: { label: 'layerTasks', icon: 'task' },
    weather: { label: 'layerWeather', icon: 'cloud' },
    services: { label: 'layerServices', icon: 'cross' },
    relief: { label: 'layerRelief', icon: 'relief' },
    radar: { label: 'layerRadar', icon: 'radar' },
    grid: { label: 'layerGrid', icon: 'grid' },
  };

/**
 * The switches by what they are about: the team's own, the surroundings, and the aids to find
 * one's way. Every switch is in exactly one section (a test checks it).
 */
export const LAYER_SECTIONS: readonly {
  readonly title: MessageKey;
  readonly switches: readonly LayerSwitch[];
}[] = [
  { title: 'layersTeam', switches: ['members', 'trails', 'objects', 'tasks'] },
  { title: 'layersSurroundings', switches: ['weather', 'services', 'relief'] },
  { title: 'layersOrientation', switches: ['radar', 'grid'] },
];

export function isFlag(name: LayerSwitch): name is MapFlag {
  return (MAP_FLAGS as readonly string[]).includes(name);
}
