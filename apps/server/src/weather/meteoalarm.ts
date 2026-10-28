// MeteoAlarm's warnings feed (EUMETNET), as JSON: the CAP alerts of a country's weather service,
// each with its regions by EMMA_ID code. Reads the warnings still in force, by region, in the
// languages the app speaks (docs/protocol.md §8.2).

import {
  WARNING_LEVELS,
  type WarningLanguage,
  type WarningLevel,
  type WarningText,
  type WeatherWarning,
} from '@tesel/protocol';

/** The feed of each country we gather, by ISO country code. */
export const FEED_URLS: Readonly<Record<string, string>> = {
  ES: 'https://feeds.meteoalarm.org/api/v1/warnings/feeds-spain',
  PT: 'https://feeds.meteoalarm.org/api/v1/warnings/feeds-portugal',
};

export const SOURCE = 'MeteoAlarm (EUMETNET) — CC BY 4.0';

interface CapInfo {
  readonly language?: string;
  readonly event?: string;
  readonly description?: string;
  readonly onset?: string;
  readonly expires?: string;
  readonly parameter?: readonly { readonly valueName?: string; readonly value?: string }[];
  readonly area?: readonly {
    readonly geocode?: readonly { readonly valueName?: string; readonly value?: string }[];
  }[];
}

interface CapAlert {
  readonly identifier?: string;
  readonly msgType?: string;
  /** "sender,identifier,sent" triples separated by spaces: the alerts this one replaces. */
  readonly references?: string;
  readonly info?: readonly CapInfo[];
}

/**
 * The warnings in force at `now` (seconds), by region code. Cancellations, and alerts replaced
 * by a newer one, are left out.
 */
export function warningsByRegion(feed: unknown, now: number): Map<string, WeatherWarning[]> {
  const alerts = alertsOf(feed);
  const replaced = new Set(
    alerts.flatMap((alert) =>
      (alert.references ?? '').split(/\s+/).flatMap((triple) => triple.split(',')[1] ?? []),
    ),
  );
  const byRegion = new Map<string, WeatherWarning[]>();
  for (const alert of alerts) {
    if (alert.msgType === 'Cancel' || replaced.has(alert.identifier ?? '')) continue;
    const info = alert.info ?? [];
    const warning = warningOf(info, now);
    if (warning === null) continue;
    for (const code of regionCodes(info[0])) {
      byRegion.set(code, [...(byRegion.get(code) ?? []), warning]);
    }
  }
  return byRegion;
}

function alertsOf(feed: unknown): CapAlert[] {
  if (typeof feed !== 'object' || feed === null) return [];
  const warnings = (feed as { warnings?: unknown }).warnings;
  if (!Array.isArray(warnings)) return [];
  return warnings.flatMap((item: unknown) => {
    const alert = (item as { alert?: CapAlert } | null)?.alert;
    return alert ? [alert] : [];
  });
}

/** One warning from the alert's info blocks, one per language, or null if not in force. */
function warningOf(info: readonly CapInfo[], now: number): WeatherWarning | null {
  const [first] = info;
  if (first === undefined) return null;
  const level = levelOf(first);
  const onset = seconds(first.onset);
  const expires = seconds(first.expires);
  if (level === null || onset === null || expires === null || expires <= now) return null;
  const text: Partial<Record<WarningLanguage, WarningText>> = {};
  for (const block of info) {
    const language = block.language?.slice(0, 2);
    if ((language === 'es' || language === 'en') && block.event !== undefined) {
      text[language] = { event: block.event, description: block.description ?? '' };
    }
  }
  return { level, onset, expires, text };
}

/** The awareness level, from a parameter such as "3; orange; Severe"; green (1) is no warning. */
function levelOf(info: CapInfo): WarningLevel | null {
  const value = info.parameter?.find((p) => p.valueName === 'awareness_level')?.value;
  const level = Number(value?.split(';')[0]);
  return WARNING_LEVELS.includes(level as WarningLevel) ? (level as WarningLevel) : null;
}

function regionCodes(info: CapInfo | undefined): string[] {
  return (info?.area ?? []).flatMap((area) =>
    (area.geocode ?? []).flatMap((code) =>
      code.valueName === 'EMMA_ID' && code.value !== undefined ? [code.value] : [],
    ),
  );
}

function seconds(iso: string | undefined): number | null {
  const ms = iso === undefined ? NaN : Date.parse(iso);
  return Number.isFinite(ms) ? Math.floor(ms / 1000) : null;
}
