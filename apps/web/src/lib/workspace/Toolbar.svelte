<!-- The buttons at the bottom of the map: SOS, position, drawing and chat with a group; the tools
     menu always. -->
<script lang="ts">
  import type { Translate } from '../i18n/index.ts';
  import type { DraftKind } from '../objects/draft.ts';
  import DrawMenu from '../objects/DrawMenu.svelte';
  import PositionControl from '../position/PositionControl.svelte';
  import type { PositionSharing } from '../position/position-sharing.svelte.ts';
  import type { Preference } from '../settings/preference.svelte.ts';
  import { panels, togglePanel } from '../ui/panels.svelte.ts';
  import ToolsMenu from './ToolsMenu.svelte';

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
</script>

<div class="toolbar">
  {#if sharing}
    <button class="sos" onclick={onsos}>{t('sos')}</button>
  {/if}
  <div class="actions">
    {#if sharing}
      <PositionControl {t} {sharing} />
      <DrawMenu {t} onstart={ondraw} />
      <button
        class="fab"
        aria-expanded={panels.open === 'chat'}
        onclick={() => {
          togglePanel('chat');
        }}
      >
        {t('chat')}
      </button>
    {/if}
    <ToolsMenu {t} {onmeasure} {keepScreenOn} withGroup={sharing !== null} />
  </div>
</div>

<style>
  .toolbar {
    position: absolute;
    z-index: 1;
    right: 1rem;
    bottom: calc(2.5rem + env(safe-area-inset-bottom));
    left: 1rem;
    display: flex;
    gap: 0.75rem;
    align-items: flex-end;
    pointer-events: none;
  }

  .actions {
    display: flex;
    flex: 1;
    flex-wrap: wrap-reverse;
    gap: 0.5rem;
    justify-content: flex-end;
  }

  .sos {
    width: 4rem;
    height: 4rem;
    font-weight: 800;
    color: #fff;
    pointer-events: auto;
    background: var(--danger);
    border: 3px solid #fff;
    border-radius: 50%;
    box-shadow: 0 4px 16px rgb(0 0 0 / 35%);
  }
</style>
