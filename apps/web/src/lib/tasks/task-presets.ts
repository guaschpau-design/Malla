// The tasks a team of volunteers gives most often in an emergency, offered when a new task is
// written: one tap fills its text, which can still be changed. Most happen somewhere, so they are
// at their best from "Task here" on a point of the map.

import type { MessageKey } from '../i18n/index.ts';

export const TASK_PRESETS: readonly MessageKey[] = [
  'presetSearchArea',
  'presetCheckHome',
  'presetTreatInjured',
  'presetEvacuatePerson',
  'presetVisitVulnerable',
  'presetCarrySupplies',
  'presetMarkHazard',
  'presetWatchAndReport',
  'presetSetUpMeetingPoint',
];
