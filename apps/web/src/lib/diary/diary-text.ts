// The diary as a plain text file, for the report of an operation: a header, then one line per
// entry with its time, author, what happened and where.

import { formatCoordinate, type CoordinateFormat } from '../coordinates/coordinates.ts';
import { formatDateTime } from '../format.ts';
import type { Locale, Translate } from '../i18n/index.ts';
import type { DiaryLine } from './diary.ts';

export interface DiaryTextOptions {
  readonly group: string;
  readonly format: CoordinateFormat;
  readonly locale: Locale;
  readonly t: Translate;
  /** When the file is made, in milliseconds. */
  readonly now: number;
}

export function diaryText(lines: readonly DiaryLine[], options: DiaryTextOptions): string {
  const { group, format, locale, t, now } = options;
  const header = [
    `Tesel · ${t('diary')}`,
    t('diaryFileGroup', { group }),
    t('diaryFileMade', { time: formatDateTime(now, locale) }),
    '',
  ];
  const body = lines.map((line) => {
    const where = line.at && formatCoordinate(line.at, format);
    const parts = [formatDateTime(line.time * 1000, locale), line.author, line.text];
    return parts.join(' · ') + (where ? ` (${where})` : '');
  });
  return [...header, ...body, ''].join('\n');
}

/** A file name that sorts by date and says which group: "tesel-equipo-turia-2026-10-26.txt". */
export function fileName(group: string, now: number, extension: string): string {
  const slug = group
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  const date = new Date(now).toISOString().slice(0, 10);
  return `tesel-${slug || 'grupo'}-${date}.${extension}`;
}
