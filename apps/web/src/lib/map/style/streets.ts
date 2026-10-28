// The street map's palette: a map to find a street, a building and a way in by road. The land is
// neutral, so that members, zones and SOS calls stand out on it; buildings show; roads are coloured
// by class, motorways orange and main roads yellow, as road maps draw them. The topographic map
// (topo.ts) is the one for the terrain.

import { namedFlavor, type Flavor } from '@protomaps/basemaps';

import type { MapTheme } from '../../ui/theme.ts';

const STREET_PALETTE: Readonly<Record<MapTheme, Partial<Flavor>>> = {
  light: {
    background: '#f2f1ee',
    earth: '#f2f1ee',
    park_a: '#e9ece6',
    park_b: '#e1e8dc',
    wood_a: '#e8ebe5',
    wood_b: '#dfe5da',
    scrub_a: '#ebece6',
    scrub_b: '#e5e8df',
    landcover: {
      grassland: 'rgba(234, 236, 229, 1)',
      barren: 'rgba(240, 238, 232, 1)',
      urban_area: 'rgba(233, 232, 229, 1)',
      farmland: 'rgba(238, 239, 233, 1)',
      glacier: 'rgba(255, 255, 255, 1)',
      scrub: 'rgba(235, 237, 230, 1)',
      forest: 'rgba(226, 231, 222, 1)',
    },
    buildings: '#c9c2b9',
    other: '#cfc9c0',
    minor_casing: '#d3cfc9',
    minor_service_casing: '#ddd9d3',
    highway: '#f6b878',
    highway_casing_early: '#dc9452',
    highway_casing_late: '#dc9452',
    bridges_highway: '#f6b878',
    bridges_highway_casing: '#dc9452',
    tunnel_highway: '#fad7b1',
    major: '#fde9b0',
    major_casing_early: '#eed9a0',
    major_casing_late: '#e6cf93',
    bridges_major: '#fde9b0',
    bridges_major_casing: '#e6cf93',
    tunnel_major: '#fdf1cf',
    link: '#fde9b0',
    link_casing: '#eed9a0',
    bridges_link: '#fde9b0',
    bridges_link_casing: '#e6cf93',
    tunnel_link: '#fdf1cf',
    roads_label_minor: '#5c5759',
    roads_label_major: '#4a4547',
    address_label: '#6e6869',
  },
  dark: {
    buildings: '#2c2c2c',
    minor_a: '#474747',
    minor_b: '#474747',
    highway: '#8a5a2b',
    bridges_highway: '#8a5a2b',
    tunnel_highway: '#4a3a2a',
    major: '#6e5f33',
    bridges_major: '#6e5f33',
    tunnel_major: '#3d362a',
    link: '#6e5f33',
    bridges_link: '#6e5f33',
    tunnel_link: '#3d362a',
    roads_label_minor: '#8a8a8a',
    roads_label_major: '#a0a0a0',
    address_label: '#8a8a8a',
  },
};

export function streetFlavor(theme: MapTheme): Flavor {
  return { ...namedFlavor(theme), ...STREET_PALETTE[theme] };
}
