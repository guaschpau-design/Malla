<!-- What can be done with the thing a panel shows, as a row of buttons. Up to three fit a phone's
     width and all show; with more, the first two show and the rest wait in a "⋯" menu at the end
     of the row (ADR-0065). So list them most used first. -->
<script lang="ts">
  import type { Action } from './action.ts';
  import ActionButton from './ActionButton.svelte';
  import Menu from './Menu.svelte';
  import Pictogram from './Pictogram.svelte';

  interface Props {
    actions: readonly Action[];
    /** The name of the "⋯" button and its menu. */
    moreLabel: string;
  }

  let { actions, moreLabel }: Props = $props();

  /** As many as fit a phone's width; past it, one place goes to the menu's button. */
  const FIT = 3;
  const shown = $derived(actions.length <= FIT ? actions : actions.slice(0, FIT - 1));
  const folded = $derived(actions.slice(shown.length));
</script>

<div class="row">
  {#each shown as action (action.label)}
    <ActionButton icon={action.icon} label={action.label} onclick={action.run} />
  {/each}
  {#if folded.length > 0}
    <Menu label={moreLabel} place="end">
      {#snippet trigger(expanded: boolean, toggle: () => void)}
        <button
          class="more"
          aria-haspopup="menu"
          aria-expanded={expanded}
          aria-label={moreLabel}
          title={moreLabel}
          onclick={toggle}
        >
          <Pictogram name="more" size={20} />
        </button>
      {/snippet}
      {#snippet items(close: () => void)}
        {#each folded as action (action.label)}
          <button
            role="menuitem"
            onclick={() => {
              close();
              action.run();
            }}
          >
            <Pictogram name={action.icon} size={20} />
            {action.label}
          </button>
        {/each}
      {/snippet}
    </Menu>
  {/if}
</div>

<style>
  .more {
    min-width: var(--control-size);
    padding: 0;
  }
</style>
