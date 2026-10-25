<!-- Button and menu to share, pause or hide this device's position. -->
<script lang="ts">
  import type { MessageKey, Translate } from '../i18n/index.ts';
  import type { PositionMode, PositionSharing } from './position-sharing.svelte.ts';

  interface Props {
    t: Translate;
    sharing: PositionSharing;
  }

  let { t, sharing }: Props = $props();

  let open = $state(false);

  const OPTIONS: readonly { mode: PositionMode; label: MessageKey; hint: MessageKey }[] = [
    { mode: 'sharing', label: 'positionShare', hint: 'positionShareHint' },
    { mode: 'paused', label: 'positionPause', hint: 'positionPauseHint' },
    { mode: 'hidden', label: 'positionHide', hint: 'positionHideHint' },
  ];

  const STATES: Readonly<Record<PositionMode, MessageKey>> = {
    sharing: 'positionStateSharing',
    paused: 'positionStatePaused',
    hidden: 'positionStateHidden',
  };

  async function choose(mode: PositionMode): Promise<void> {
    open = false;
    await sharing.setMode(mode);
  }
</script>

<div class="position">
  {#if open}
    <div class="menu" role="menu" aria-label={t('positionTitle')}>
      {#each OPTIONS as option (option.mode)}
        <button
          role="menuitemradio"
          aria-checked={sharing.mode === option.mode}
          class:current={sharing.mode === option.mode}
          onclick={() => choose(option.mode)}
        >
          <strong>{t(option.label)}</strong>
          <span>{t(option.hint)}</span>
        </button>
      {/each}
    </div>
  {/if}
  <button
    class="fab"
    class:on={sharing.mode === 'sharing'}
    aria-expanded={open}
    aria-label="{t('positionTitle')}: {t(STATES[sharing.mode])}"
    onclick={() => (open = !open)}
  >
    {t(STATES[sharing.mode])}
  </button>
</div>

<style>
  .position {
    position: relative;
    pointer-events: auto;
  }

  .menu {
    position: absolute;
    z-index: 3; /* above the neighbouring buttons, which are positioned too */
    right: 0;
    bottom: calc(100% + 0.5rem);
    display: grid;
    gap: 0.25rem;
    width: min(18rem, calc(100vw - 2rem));
    padding: 0.4rem;
    background: var(--surface);
    border-radius: 0.75rem;
    box-shadow: 0 4px 16px rgb(0 0 0 / 30%);
  }

  .menu button {
    display: grid;
    gap: 0.15rem;
    text-align: left;
    border-color: transparent;
  }

  .menu button.current {
    border-color: var(--accent);
  }

  .menu span {
    color: var(--muted);
    font-size: 0.85rem;
  }
</style>
