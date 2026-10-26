// A search along the old Turia riverbed in Valencia: a sector being searched, a meeting point, a
// first-aid post and a closed path, a medical SOS acknowledged by a teammate, and the team's chat.
// It is the operation the site's screenshots show; Ana, the coordinator, is the browser.

import type { Scenario } from '@tesel/scenario';

// Symbol and style codes: protocol §4.
const BLOCKED_ROAD = 6;
const MEETING_POINT = 8;
const MEDICAL_POST = 9;
const SEARCH_ASSIGNED = 2;

export const turia: Scenario = {
  name: 'turia',
  description: 'Búsqueda en el antiguo cauce del Turia, en Valencia, con un SOS médico.',
  center: { lat: 39.4781, lon: -0.3745 },
  duration: 360,
  members: [
    {
      alias: 'Luis',
      route: [
        { lat: 39.4801, lon: -0.3731 },
        { lat: 39.4796, lon: -0.3716 },
      ],
      speed: 0.5,
    },
    { alias: 'Jordi', route: [{ lat: 39.4766, lon: -0.3768 }] },
    { alias: 'Carmen', route: [{ lat: 39.4799, lon: -0.3786 }] },
    { alias: 'Marta', route: [{ lat: 39.4771, lon: -0.3714 }], hidden: true },
  ],
  steps: [
    {
      at: 0,
      by: 'Luis',
      action: {
        type: 'shape',
        id: 'sector-2',
        style: SEARCH_ASSIGNED,
        label: 'Sector 2',
        geometry: {
          kind: 'polygon',
          points: [
            { lat: 39.4797, lon: -0.3744 },
            { lat: 39.4791, lon: -0.3699 },
            { lat: 39.4763, lon: -0.3703 },
            { lat: 39.4767, lon: -0.3749 },
          ],
        },
      },
    },
    {
      at: 5,
      by: 'Carmen',
      action: {
        type: 'marker',
        id: 'meeting-point',
        symbol: MEETING_POINT,
        label: 'Punto de encuentro',
        where: { lat: 39.4794, lon: -0.3763 },
      },
    },
    {
      at: 10,
      by: 'Carmen',
      action: {
        type: 'marker',
        id: 'first-aid',
        symbol: MEDICAL_POST,
        label: 'Puesto sanitario',
        where: { lat: 39.4787, lon: -0.3786 },
      },
    },
    {
      at: 15,
      by: 'Luis',
      action: {
        type: 'marker',
        id: 'closed-path',
        symbol: BLOCKED_ROAD,
        label: 'Paso cortado',
        where: { lat: 39.4779, lon: -0.3727 },
      },
    },
    {
      at: 60,
      by: 'Luis',
      action: { type: 'chat', text: 'Empiezo el sector 2 por el puente. Sin novedad.' },
    },
    {
      at: 120,
      by: 'Carmen',
      action: { type: 'chat', text: 'Puesto sanitario montado junto a la pasarela.' },
    },
    {
      at: 300,
      by: 'Marta',
      action: {
        type: 'sos',
        id: 'marta',
        kind: 'medical',
        text: 'Torcedura, no puedo apoyar el pie',
      },
    },
    { at: 330, by: 'Jordi', action: { type: 'ack', of: 'marta' } },
    {
      at: 340,
      by: 'Jordi',
      action: { type: 'chat', text: 'Voy hacia Marta, llego en 4 minutos.' },
    },
  ],
};
