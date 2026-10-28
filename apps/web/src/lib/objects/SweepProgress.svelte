<!-- How each strip of a sweep is going: its team's colour, who walks it and how much of it their
     trail has swept, or that it is done. A strip tapped opens. -->
<script lang="ts">
  import type { GroupState } from '@tesel/core';
  import type { SweepEvent } from '@tesel/protocol';

  import type { Translate } from '../i18n/index.ts';
  import { aliasOf } from '../members/alias.ts';
  import { isStripDone, stripOf, stripWalker, sweptBy, TEAM_TONES } from './sweeps.ts';

  interface Props {
    t: Translate;
    groupState: GroupState;
    strips: readonly { readonly key: string; readonly sweep: SweepEvent }[];
    /** Opens a strip; none when the list is the strip's own. */
    onselect?: ((key: string) => void) | undefined;
  }

  let { t, groupState, strips, onselect }: Props = $props();

  const rows = $derived(
    strips.map(({ key, sweep }) => {
      const strip = stripOf(sweep, groupState.objects);
      const walker = stripWalker(groupState.tasks, key);
      return {
        key,
        number: sweep.strip + 1,
        tone: TEAM_TONES[sweep.strip % TEAM_TONES.length] ?? 'slate',
        who: walker === null ? t('anyone') : aliasOf(groupState, walker),
        done: isStripDone(groupState.tasks, key),
        swept: strip && walker !== null ? sweptBy(strip, groupState.trails, walker) : null,
      };
    }),
  );
</script>

{#snippet content(row: (typeof rows)[number])}
  <span class="swatch" style:--swatch="var(--tone-{row.tone})"></span>
  <span class="what">
    <span>{t('stripNumber', { number: row.number })} · {row.who}</span>
    {#if row.done}
      <strong>{t('stripDone')}</strong>
    {:else if row.swept !== null}
      <span class="bar"><span style:width="{row.swept * 100}%"></span></span>
      <span class="hint">{t('sweptPercent', { percent: Math.round(row.swept * 100) })}</span>
    {/if}
  </span>
{/snippet}

<ul class="strips">
  {#each rows as row (row.key)}
    <li>
      {#if onselect}
        {@const open = onselect}
        <button
          class="strip"
          onclick={() => {
            open(row.key);
          }}>{@render content(row)}</button
        >
      {:else}
        <div class="strip">{@render content(row)}</div>
      {/if}
    </li>
  {/each}
</ul>

<style>
  .strips {
    display: grid;
    gap: 0.35rem;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .strip {
    display: flex;
    gap: 0.6rem;
    align-items: center;
    box-sizing: border-box;
    width: 100%;
    padding: 0.35rem 0.5rem;
    font: inherit;
    font-size: var(--text-secondary);
    text-align: left;
    border: 1px solid var(--border);
    border-radius: var(--radius-control);
  }

  .swatch {
    flex-shrink: 0;
    width: 0.9rem;
    height: 0.9rem;
    background: var(--swatch);
    border-radius: 50%;
  }

  .what {
    display: flex;
    flex: 1;
    flex-wrap: wrap;
    gap: 0.2rem 0.6rem;
    align-items: center;
  }

  .bar {
    flex: 1;
    min-width: 4rem;
    height: 0.4rem;
    overflow: hidden;
    background: var(--border);
    border-radius: var(--radius-pill);
  }

  .bar span {
    display: block;
    height: 100%;
    background: var(--accent-line);
  }
</style>
