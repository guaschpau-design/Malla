<!-- The bottom of the map: the SOS button and the dock — Me and More always; with a group, the SOS
     button, Add, Chat and Tasks. Everything else starts from what is tapped on the map. -->
<script lang="ts">
  import type { MessageKey, Translate } from '../i18n/index.ts';
  import AddMenu from '../objects/AddMenu.svelte';
  import type { DraftKind } from '../objects/draft.ts';
  import type { PositionMode } from '../position/position-mode.ts';
  import type { PositionSharing } from '../position/position-sharing.svelte.ts';
  import DockButton from '../ui/DockButton.svelte';
  import { TASK_LIST } from '../tasks/task-editor.ts';
  import { CHAT } from '../chat/chat-tabs.ts';
  import { isOpen, togglePanel } from '../ui/panels.svelte.ts';
  import MoreMenu from './MoreMenu.svelte';

  interface Props {
    t: Translate;
    /** How this device shares its position in the active group; null without one. */
    sharing: PositionSharing | null;
    onsos: () => void;
    ondraw: (kind: DraftKind) => void;
    onmeasure: () => void;
    /** Pending tasks assigned to this device. */
    tasksForMe: number;
    /** Drawing or measuring: only the SOS button stays, the rest makes room for the map. */
    drawingOrMeasuring: boolean;
  }

  let { t, sharing, onsos, ondraw, onmeasure, tasksForMe, drawingOrMeasuring }: Props = $props();

  /** With a group there is always a way of sharing the position in it. */
  const inGroup = $derived(sharing !== null);

  const STATES: Readonly<Record<PositionMode, MessageKey>> = {
    sharing: 'positionStateSharing',
    paused: 'positionStatePaused',
    hidden: 'positionStateHidden',
  };
</script>

<div class="bottom">
  {#if inGroup}
    <button class="sos" onclick={onsos}>{t('sos')}</button>
  {/if}
  {#if !drawingOrMeasuring}
    <nav class="dock chrome" aria-label={t('dock')}>
      <DockButton
        icon="person"
        label={t('me')}
        ariaLabel={sharing ? `${t('me')}: ${t(STATES[sharing.mode])}` : t('me')}
        on={sharing?.mode === 'sharing'}
        expanded={isOpen('me')}
        onclick={() => {
          togglePanel('me');
        }}
      />
      {#if inGroup}
        <AddMenu {t} onstart={ondraw} />
        <DockButton
          icon="chat"
          label={t('chat')}
          expanded={isOpen('chat')}
          onclick={() => {
            togglePanel(CHAT);
          }}
        />
        <DockButton
          icon="task"
          label={t('tasks')}
          ariaLabel={tasksForMe > 0 ? t('tasksForYou', { count: tasksForMe }) : t('tasks')}
          count={tasksForMe}
          expanded={isOpen('tasks')}
          onclick={() => {
            togglePanel(TASK_LIST);
          }}
        />
      {/if}
      <MoreMenu {t} {onmeasure} withGroup={inGroup} />
    </nav>
  {/if}
</div>

<style>
  /* No z-index here: the menus of the dock must rise over the cards of the map, which a stacking
     context of the dock's own would keep them under. */
  .bottom {
    position: absolute;
    right: max(0.75rem, env(safe-area-inset-right));
    bottom: calc(0.75rem + env(safe-area-inset-bottom));
    left: max(0.75rem, env(safe-area-inset-left));
    display: flex;
    gap: 0.75rem;
    align-items: flex-end;
    pointer-events: none;
  }

  .dock {
    position: relative;
    display: flex;
    min-width: 0;
    margin-left: auto;
    gap: 0.15rem;
    max-width: 24rem;
    padding: 0.25rem;
    pointer-events: auto;
    border-radius: var(--radius-sheet);
    box-shadow: var(--shadow-float);
  }

  .sos {
    flex-shrink: 0;
    width: 4rem;
    height: 4rem;
    font-weight: 800;
    color: var(--on-danger);
    pointer-events: auto;
    background: var(--danger-fill);
    border: 3px solid var(--on-danger);
    border-radius: 50%;
    box-shadow: var(--shadow-float);
  }

  /* Room for five buttons beside the SOS on the narrowest phones, the SOS first. */
  @media (max-width: 22.5rem) {
    .sos {
      width: 3.4rem;
      height: 3.4rem;
    }

    .dock :global(.dock-button) {
      min-width: 2.75rem;
    }
  }
</style>
