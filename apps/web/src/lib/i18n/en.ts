// The English dictionary defines the set of keys. Every other language must provide all of them.

export const en = {
  appTagline: 'Shared situational awareness for civil society, online and over LoRa mesh.',
  online: 'Online',
  offline: 'Offline',
  switchLanguage: 'Español',
  offlineAreas: 'Offline maps',
  close: 'Close',
  areasIntro:
    'Download the map of the area where you may need it. Without a connection, the app shows downloaded areas only.',
  downloadVisible: 'Download visible area',
  areaName: 'Name',
  defaultAreaName: 'Area {date}',
  detail: 'Detail',
  detailStreets: 'Streets (zoom 14)',
  detailTown: 'Town (zoom 13)',
  detailRegion: 'Region (zoom 12)',
  estimate: '{tiles} tiles, about {size}',
  areaTooLarge: 'This area is too large. Zoom in or choose less detail.',
  download: 'Download',
  cancel: 'Cancel',
  downloading: 'Downloading… {done} of {total}',
  downloadFailed: 'The download stopped. Delete the area and try again.',
  noAreas: 'No offline maps yet.',
  incomplete: 'Incomplete',
  showOnMap: 'Show on map',
  delete: 'Delete',
  confirmDelete: 'Delete the offline map "{name}"?',
  storageUsed: 'Storage used by the app: {used} of {quota}',
  updateAvailable: 'A new version is available.',
  update: 'Update',
  readyOffline: 'The app is ready to work offline.',
} as const;

export type MessageKey = keyof typeof en;
export type Messages = { readonly [K in MessageKey]: string };
