<!-- The bottom of the map: the SOS button and the dock — Me, Add, Chat and Tasks with a group,
     More always. Everything else starts from what is tapped on the map. -->
<script lang="ts">
  import type { Locale, MessageKey, Translate } from '../i18n/index.ts';
  import AddMenu from '../objects/AddMenu.svelte';
  import type { DraftKind } from '../objects/draft.ts';
  import type { PositionMode } from '../position/position-mode.ts';
  import type { PositionSharing } from '../position/position-sharing.svelte.ts';
  import type { Preferences } from '../settings/preferences.ts';
  import DockButton from '../ui/DockButton.svelte';
  import { stopEditingTask } from '../tasks/task-editor.svelte.ts';
  import { panels, togglePanel } from '../ui/panels.svelte.ts';
  import MoreMenu from './MoreMenu.svelte';

  interface Props {
    t: Translate;
    /** How this device shares its position in the active group; null without one. */
    sharing: PositionSharing | null;
    onsos: () => void;
    ondraw: (kind: DraftKind) => void;
    onmeasure: () => void;
    preferences: Preferences;
    locale: Locale;
    /** Pending tasks assigned to this device. */
    tasksForMe: number;
    /** Drawing or measuring: only the SOS button stays, the rest makes room for the map. */
    tapping: boolean;
  }

  let { t, sharing, onsos, ondraw, onmeasure, preferences, locale, tasksForMe, tapping }: Props =
    $props();

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
  {#if !tapping}
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
        <DockButton
          icon="task"
          label={t('tasks')}
          ariaLabel={tasksForMe > 0 ? t('tasksForYou', { count: tasksForMe }) : t('tasks')}
          count={tasksForMe}
          expanded={panels.open === 'tasks'}
          onclick={() => {
            stopEditingTask();
            togglePanel('tasks');
          }}
        />
      {/if}
      <MoreMenu {t} {preferences} {locale} {onmeasure} withGroup={sharing !== null} />
    </nav>
  {/if}
</div>

<style>
  /* No z-index here: the menus of the dock must rise over the cards of the map, which a stacking
     context of the dock's own would keep them under. */
  .bottom {
    position: absolute;
    right: 0.75rem;
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
    color: var(--chrome-fg);
    pointer-events: auto;
    background: var(--chrome-bg);
    border-radius: var(--radius-sheet);
    box-shadow: var(--shadow-float);
  }

  .sos {
    flex-shrink: 0;
    width: 4rem;
    height: 4rem;
    font-weight: 800;
    color: #fff;
    pointer-events: auto;
    background: var(--danger);
    border: 3px solid #fff;
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
