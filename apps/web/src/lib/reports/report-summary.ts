// A situation report in words, line by line as its card shows it and in one line for the diary:
// only what the report tells, nothing for what it leaves unknown.

import type { Casualties, ReportEvent } from '@tesel/protocol';

import type { Translate } from '../i18n/index.ts';
import {
  ACCESS,
  HAZARDS,
  INCIDENTS,
  labelOf,
  RESOURCES,
  TRIAGE,
  type Choice,
} from './report-catalog.ts';

export interface ReportLines {
  /** What happened. */
  readonly incident: string;
  readonly casualties: string | null;
  readonly access: string | null;
  readonly hazards: string | null;
  readonly resources: string | null;
}

export function reportLines(report: ReportEvent, t: Translate): ReportLines {
  const words = <T>(list: readonly T[], choices: readonly Choice<T>[]) =>
    list.flatMap((value) => {
      const label = labelOf(choices, value);
      return label ? [t(label)] : [];
    });
  const access = report.access === 'unknown' ? null : labelOf(ACCESS, report.access);
  const hazards = words(report.hazards, HAZARDS);
  const resources = words(report.resources, RESOURCES);
  return {
    incident: t(labelOf(INCIDENTS, report.incident) ?? 'incidentOther'),
    casualties: casualtiesLine(report.casualties, t),
    access: access && t(access),
    hazards: hazards.length > 0 ? t('reportHazards', { list: hazards.join(', ') }) : null,
    resources: resources.length > 0 ? t('reportResources', { list: resources.join(', ') }) : null,
  };
}

/** The report in one line, its note last. */
export function reportLine(report: ReportEvent, t: Translate): string {
  const lines = reportLines(report, t);
  const parts = [
    lines.incident,
    lines.casualties,
    lines.access,
    lines.hazards,
    lines.resources,
    report.note || null,
  ];
  return parts.filter((part) => part !== null).join(' · ');
}

/** How many casualties of each category, those told; null if none is. */
export function casualtiesLine(casualties: Casualties, t: Translate): string | null {
  const told = TRIAGE.flatMap(({ value, label }) => {
    const count = casualties[value];
    return count === null ? [] : [`${t(label)}: ${String(count)}`];
  });
  return told.length > 0 ? t('reportCasualties', { list: told.join(', ') }) : null;
}

/** The casualties of several reports added up, unknowns as none. */
export function addedUp(reports: readonly ReportEvent[]): Casualties {
  const sum = (key: keyof Casualties) => {
    const counts = reports.flatMap((report) => {
      const count = report.casualties[key];
      return count === null ? [] : [count];
    });
    return counts.length > 0 ? counts.reduce((a, b) => a + b, 0) : null;
  };
  return { red: sum('red'), yellow: sum('yellow'), green: sum('green'), black: sum('black') };
}
