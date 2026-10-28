// How the app names what a situation report says (protocol §3.16), in the order the form offers
// it: what happened, the dangers, the way in, the casualties by triage category and the help.

import type { Casualties, Hazard, IncidentType, Resource, SceneAccess } from '@tesel/protocol';

import type { MessageKey } from '../i18n/index.ts';

export interface Choice<T> {
  readonly value: T;
  readonly label: MessageKey;
}

export const INCIDENTS: readonly Choice<IncidentType>[] = [
  { value: 'fire', label: 'incidentFire' },
  { value: 'flood', label: 'incidentFlood' },
  { value: 'traffic-accident', label: 'incidentTrafficAccident' },
  { value: 'collapse', label: 'incidentCollapse' },
  { value: 'missing-person', label: 'incidentMissingPerson' },
  { value: 'rescue', label: 'incidentRescue' },
  { value: 'hazardous-materials', label: 'incidentHazardousMaterials' },
  { value: 'medical', label: 'incidentMedical' },
  { value: 'other', label: 'incidentOther' },
];

export const HAZARDS: readonly Choice<Hazard>[] = [
  { value: 'fire', label: 'hazardFire' },
  { value: 'smoke', label: 'hazardSmoke' },
  { value: 'gas', label: 'hazardGas' },
  { value: 'electricity', label: 'hazardElectricity' },
  { value: 'water', label: 'hazardWater' },
  { value: 'collapse', label: 'hazardCollapse' },
  { value: 'chemicals', label: 'hazardChemicals' },
  { value: 'traffic', label: 'hazardTraffic' },
  { value: 'violence', label: 'hazardViolence' },
];

/** The ways in that can be told; unknown is what is left untold. */
export const ACCESS: readonly Choice<Exclude<SceneAccess, 'unknown'>>[] = [
  { value: 'clear', label: 'accessClear' },
  { value: 'difficult', label: 'accessDifficult' },
  { value: 'blocked', label: 'accessBlocked' },
];

export const RESOURCES: readonly Choice<Resource>[] = [
  { value: 'ambulance', label: 'resourceAmbulance' },
  { value: 'firefighters', label: 'resourceFirefighters' },
  { value: 'police', label: 'resourcePolice' },
  { value: 'rescue', label: 'resourceRescue' },
  { value: 'helicopter', label: 'resourceHelicopter' },
  { value: 'machinery', label: 'resourceMachinery' },
  { value: 'people', label: 'resourcePeople' },
  { value: 'supplies', label: 'resourceSupplies' },
  { value: 'shelter', label: 'resourceShelter' },
];

/** The triage categories, most urgent first, each named and drawn in its colour. */
export const TRIAGE: readonly {
  readonly value: keyof Casualties;
  readonly label: MessageKey;
}[] = [
  { value: 'red', label: 'triageRed' },
  { value: 'yellow', label: 'triageYellow' },
  { value: 'green', label: 'triageGreen' },
  { value: 'black', label: 'triageBlack' },
];

export function labelOf<T>(choices: readonly Choice<T>[], value: T): MessageKey | null {
  return choices.find((choice) => choice.value === value)?.label ?? null;
}
