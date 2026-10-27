<!-- Official weather warnings, each with its level, what it warns of and when, and its full text
     on demand; then who issued them. -->
<script lang="ts">
  import type { WeatherWarning } from '@tesel/protocol';

  import { formatTime } from '../format.ts';
  import type { Locale, Translate } from '../i18n/index.ts';
  import { WARNING_LOOKS, warningText } from './weather-warnings.ts';

  interface Props {
    t: Translate;
    locale: Locale;
    warnings: readonly WeatherWarning[];
    source: string | null;
  }

  let { t, locale, warnings, source }: Props = $props();

  const time = (seconds: number) => formatTime(seconds * 1000, locale);
</script>

<ul class="warnings">
  {#each warnings as warning, index (index)}
    {@const look = WARNING_LOOKS[warning.level]}
    {@const text = warningText(warning, locale)}
    <li style:--level="var(--tone-{look.tone})">
      <strong>{t(look.label)}{text ? ` · ${text.event}` : ''}</strong>
      <span class="when">
        {warning.onset * 1000 > Date.now()
          ? t('warningFromUntil', { from: time(warning.onset), until: time(warning.expires) })
          : t('warningUntil', { until: time(warning.expires) })}
      </span>
      {#if text?.description}
        <details>
          <summary>{t('details')}</summary>
          <p>{text.description}</p>
        </details>
      {/if}
    </li>
  {/each}
</ul>
{#if source}<p class="source">{t('warningSource', { source })}</p>{/if}

<style>
  .warnings {
    display: grid;
    gap: 0.5rem;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  li {
    display: grid;
    gap: 0.15rem;
    padding-left: 0.6rem;
    border-left: 5px solid var(--level);
  }

  .when,
  .source,
  summary {
    color: var(--muted);
    font-size: var(--text-secondary);
  }

  details p {
    margin: 0.25rem 0 0;
    font-size: var(--text-secondary);
  }

  .source {
    margin: 0;
  }
</style>
