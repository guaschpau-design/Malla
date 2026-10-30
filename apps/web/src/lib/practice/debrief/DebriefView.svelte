<!-- The report at the end of an exercise (ADR-0073), on the practice's card: its figures, two to a
     line, then what went well and what to do better, a line each. -->
<script lang="ts">
  import type { Translate } from '../../i18n/index.ts';
  import type { Debrief } from './debrief.ts';

  interface Props {
    t: Translate;
    debrief: Debrief;
  }

  let { t, debrief }: Props = $props();
</script>

<div class="debrief">
  <h3>{t('debriefTitle')}</h3>
  <dl>
    {#each debrief.figures as figure (figure.label)}
      <dt>{figure.label}</dt>
      <dd>{figure.value}</dd>
    {/each}
  </dl>
  {#if debrief.good.length > 0}
    <h4>{t('debriefGood')}</h4>
    <ul class="good">
      {#each debrief.good as text (text)}<li>{text}</li>{/each}
    </ul>
  {/if}
  {#if debrief.better.length > 0}
    <h4>{t('debriefBetter')}</h4>
    <ul class="better">
      {#each debrief.better as text (text)}<li>{text}</li>{/each}
    </ul>
  {/if}
</div>

<style>
  .debrief {
    display: grid;
    gap: 0.35rem;
  }

  h3,
  h4 {
    margin: 0;
    font-size: var(--text-secondary);
  }

  h4 {
    margin-top: 0.25rem;
    color: var(--muted);
    font-size: var(--text-small);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  /* What is counted on the left, how it came out on the right, in figures that line up. */
  dl {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 0.15rem 0.75rem;
    margin: 0;
    padding: 0.4rem 0.6rem;
    background: var(--bg);
    border-radius: var(--radius-control);
    font-size: var(--text-small);
  }

  dt {
    color: var(--muted);
  }

  dd {
    margin: 0;
    font-variant-numeric: tabular-nums;
    font-weight: 600;
  }

  ul {
    display: grid;
    gap: 0.25rem;
    margin: 0;
    padding: 0;
    list-style: none;
    font-size: var(--text-secondary);
  }

  /* A mark before each line says which kind it is, besides the heading above. */
  li {
    display: grid;
    grid-template-columns: 1.1rem 1fr;
  }

  li::before {
    font-weight: 700;
  }

  .good li::before {
    color: var(--tone-green);
    content: '✓';
  }

  .better li::before {
    color: var(--tone-amber);
    content: '→';
  }
</style>
