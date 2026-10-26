<!-- The bottom of the map: the SOS button and the dock — Me, Add and Chat with a group, More
     always. Everything else starts from what is tapped on the map. -->
<script lang="ts">
  import type { MessageKey, Translate } from '../i18n/index.ts';
  import AddMenu from '../objects/AddMenu.svelte';
  import type { DraftKind } from '../objects/draft.ts';
  import type { PositionMode } from '../position/position-mode.ts';
  import type { PositionSharing } from '../position/position-sharing.svelte.ts';
  import type { Preference } from '../settings/preference.svelte.ts';
  import DockButton from '../ui/DockButton.svelte';
  import { panels, togglePanel } from '../ui/panels.svelte.ts';
  import MoreMenu from './MoreMenu.svelte';

  interface Props {
    t: Translate;
    /** How this device shares its position in the active group; null without one. */
    sharing: PositionSharing | null;
    onsos: () => void;
    ondraw: (kind: DraftKind) => void;
    onmeasure: () => void;
    keepScreenOn: Preference<boolean>;
  }

  let { t, sharing, onsos, ondraw, onmeasure, keepScreenOn }: Props = $props();

  const STATES: Readonly<Record<PositionMode, MessageKey>> = {
    sharing: 'positionStateSharing',
    paused: 'positionStatePaused',
    hidden: 'positionStateHidden',
  };
</script>

<div class="bottom">
  {#if sharing}
    <button class="sos" onclick={onsos}>{t('sos')}</button>
  {/if}
  <nav class="dock" aria-label={t('dock')}>
    <DockButton
      icon="person"
      label={t('me')}
      ariaLabel={sharing ? `${t('me')}: ${t(STATES[sharing.mode])}` : t('me')}
      on={sharing?.mode === 'sharing'}
      expanded={panels.open === 'me'}
      onclick={() => {
        togglePanel('me');
      }}
    />
    {#if sharing}
      <AddMenu {t} onstart={ondraw} />
      <DockButton
        icon="chat"
        label={t('chat')}
        expanded={panels.open === 'chat'}
        onclick={() => {
          togglePanel('chat');
        }}
      />
    {/if}
    <MoreMenu {t} {onmeasure} {keepScreenOn} withGroup={sharing !== null} />
  </nav>
</div>

<style>
  .bottom {
    position: absolute;
    z-index: 1;
    right: 0.75rem;
    bottom: calc(2.25rem + env(safe-area-inset-bottom));
    left: 0.75rem;
    display: flex;
    gap: 0.75rem;
    align-items: flex-end;
    justify-content: flex-end;
    pointer-events: none;
  }

  .dock {
    position: relative;
    display: flex;
    gap: 0.15rem;
    max-width: 24rem;
    padding: 0.25rem;
    color: var(--bar-fg);
    pointer-events: auto;
    background: var(--bar-bg);
    border-radius: 1.15rem;
    box-shadow: 0 4px 16px rgb(0 0 0 / 30%);
  }

  .sos {
    flex-shrink: 0;
    width: 4rem;
    height: 4rem;
    margin-right: auto;
    font-weight: 800;
    color: #fff;
    pointer-events: auto;
    background: var(--danger);
    border: 3px solid #fff;
    border-radius: 50%;
    box-shadow: 0 4px 16px rgb(0 0 0 / 35%);
  }
</style>
