// How the app names what a member tells the team about themselves (protocol §3.14): their profile,
// their status and what they carry, in the order they are offered.

import type { DutyStatus, Equipment, Profile } from '@tesel/protocol';

import type { MessageKey } from '../i18n/index.ts';
import type { StatusTone } from '../ui/status-tone.ts';

export const PROFILES: readonly { readonly value: Profile; readonly label: MessageKey }[] = [
  { value: 'unspecified', label: 'profileUnspecified' },
  { value: 'civil-protection', label: 'profileCivilProtection' },
  { value: 'firefighters', label: 'profileFirefighters' },
  { value: 'police', label: 'profilePolice' },
  { value: 'medical', label: 'profileMedical' },
  { value: 'rescue', label: 'profileRescue' },
  { value: 'volunteer', label: 'profileVolunteer' },
  { value: 'military', label: 'profileMilitary' },
  { value: 'other', label: 'profileOther' },
];

/** Each status, with the colour of its dot: ready, not now, gone; in the order offered. */
export const DUTY_STATUSES: Readonly<
  Record<DutyStatus, { readonly label: MessageKey; readonly tone: StatusTone }>
> = {
  active: { label: 'dutyActive', tone: 'good' },
  resting: { label: 'dutyResting', tone: 'fair' },
  'off-duty': { label: 'dutyOffDuty', tone: 'poor' },
};

export const EQUIPMENT: readonly { readonly value: Equipment; readonly label: MessageKey }[] = [
  { value: 'first-aid', label: 'equipmentFirstAid' },
  { value: 'defibrillator', label: 'equipmentDefibrillator' },
  { value: 'stretcher', label: 'equipmentStretcher' },
  { value: 'blankets', label: 'equipmentBlankets' },
  { value: 'water', label: 'equipmentWater' },
  { value: 'food', label: 'equipmentFood' },
  { value: 'light', label: 'equipmentLight' },
  { value: 'rope', label: 'equipmentRope' },
  { value: 'radio', label: 'equipmentRadio' },
  { value: 'extinguisher', label: 'equipmentExtinguisher' },
  { value: 'vehicle', label: 'equipmentVehicle' },
  { value: 'drone', label: 'equipmentDrone' },
  { value: 'weapon', label: 'equipmentWeapon' },
];

export function profileLabel(profile: Profile): MessageKey {
  return PROFILES.find((item) => item.value === profile)?.label ?? 'profileUnspecified';
}
