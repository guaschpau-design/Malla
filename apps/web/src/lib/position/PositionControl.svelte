<!-- Button and menu to share, pause or hide this device's position. -->
<script lang="ts">
  import type { MessageKey, Translate } from '../i18n/index.ts';
  import MenuButton from '../ui/MenuButton.svelte';
  import type { PositionMode } from './position-mode.ts';
  import type { PositionSharing } from './position-sharing.svelte.ts';

  interface Props {
    t: Translate;
    sharing: PositionSharing;
  }

  let { t, sharing }: Props = $props();

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
</script>

<MenuButton
  label={t(STATES[sharing.mode])}
  ariaLabel="{t('positionTitle')}: {t(STATES[sharing.mode])}"
  title={t('positionTitle')}
  on={sharing.mode === 'sharing'}
  wide
>
  {#snippet items(close: () => void)}
    {#each OPTIONS as option (option.mode)}
      <button
        role="menuitemradio"
        aria-checked={sharing.mode === option.mode}
        onclick={async () => {
          close();
          await sharing.setMode(option.mode);
        }}
      >
        <strong>{t(option.label)}</strong>
        <span>{t(option.hint)}</span>
      </button>
    {/each}
  {/snippet}
</MenuButton>
