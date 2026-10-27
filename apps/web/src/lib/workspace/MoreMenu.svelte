<!-- The dock's "More" menu: what is used now and then, with or without a group, and the choices of
     this device. Switches leave the menu open, so their change is seen. -->
<script lang="ts">
  import { allowNotifications, notificationsSupported } from '../incidents/alarm.ts';
  import {
    LOCALE_NAMES,
    nextLocale,
    type Locale,
    type MessageKey,
    type Translate,
  } from '../i18n/index.ts';
  import type { Preferences } from '../settings/preferences.ts';
  import DockMenu from '../ui/DockMenu.svelte';
  import {
    enterFullscreen,
    exitFullscreen,
    fullscreenSupported,
    fullscreenView,
  } from '../ui/fullscreen.svelte.ts';
  import type { GlyphName } from '../ui/glyphs.ts';
  import { notices } from '../ui/notices.svelte.ts';
  import { panels } from '../ui/panels.svelte.ts';
  import Pictogram from '../ui/Pictogram.svelte';
  import { screenWakeSupported } from '../ui/screen-awake.svelte.ts';
  import Switch from '../ui/Switch.svelte';

  interface Props {
    t: Translate;
    preferences: Preferences;
    /** The language shown now. */
    locale: Locale;
    onmeasure: () => void;
    /** The diary is the active group's. */
    withGroup: boolean;
  }

  let { t, preferences, locale, onmeasure, withGroup }: Props = $props();

  /** Now and on every later visit, until switched off again. */
  function toggleFullscreen(): void {
    const on = !fullscreenView.active;
    if (on) enterFullscreen();
    else exitFullscreen();
    void preferences.fullscreen.set(on);
  }

  /** Turning notifications on asks the browser first; a refusal is explained. */
  async function toggleNotifications(): Promise<void> {
    const on = !preferences.notifications.value;
    if (on && !(await allowNotifications())) {
      notices.show(t('notificationsRefused'), { stays: true });
      return;
    }
    await preferences.notifications.set(on);
  }

  interface Item {
    readonly icon: GlyphName;
    readonly label: MessageKey;
    readonly run: () => void;
    readonly needsGroup?: boolean;
  }

  const ITEMS: readonly Item[] = [
    {
      icon: 'ruler',
      label: 'measure',
      run: () => {
        onmeasure();
      },
    },
    { icon: 'search', label: 'findCoordinate', run: () => (panels.open = 'find') },
    { icon: 'journal', label: 'diary', run: () => (panels.open = 'diary'), needsGroup: true },
    { icon: 'download', label: 'offlineAreas', run: () => (panels.open = 'offline') },
  ];
</script>

<DockMenu icon="more" label={t('more')}>
  {#snippet items(close: () => void)}
    {#each ITEMS.filter((item) => withGroup || item.needsGroup !== true) as item (item.label)}
      <button
        role="menuitem"
        onclick={() => {
          close();
          item.run();
        }}
      >
        <Pictogram name={item.icon} size={20} />
        {t(item.label)}
      </button>
    {/each}
    <button
      role="menuitemcheckbox"
      aria-checked={preferences.alarmSound.value}
      onclick={() => void preferences.alarmSound.set(!preferences.alarmSound.value)}
    >
      <Pictogram name="warning" size={20} />
      {t('alarmSound')}
      <Switch on={preferences.alarmSound.value} />
    </button>
    {#if notificationsSupported}
      <button
        role="menuitemcheckbox"
        aria-checked={preferences.notifications.value}
        onclick={() => void toggleNotifications()}
      >
        <Pictogram name="chat" size={20} />
        {t('notifications')}
        <Switch on={preferences.notifications.value} />
      </button>
    {/if}
    {#if screenWakeSupported}
      <button
        role="menuitemcheckbox"
        aria-checked={preferences.keepScreenOn.value}
        onclick={() => void preferences.keepScreenOn.set(!preferences.keepScreenOn.value)}
      >
        <Pictogram name="screen" size={20} />
        {t('keepScreenOn')}
        <Switch on={preferences.keepScreenOn.value} />
      </button>
    {/if}
    {#if fullscreenSupported}
      <button
        role="menuitemcheckbox"
        aria-checked={fullscreenView.active}
        onclick={toggleFullscreen}
      >
        <Pictogram name="fullscreen" size={20} />
        {t('fullscreen')}
        <Switch on={fullscreenView.active} />
      </button>
    {/if}
    <!-- The next language, round the list. -->
    <button role="menuitem" onclick={() => void preferences.language.set(nextLocale(locale))}>
      <Pictogram name="language" size={20} />
      {t('language')}
      <span class="value">{LOCALE_NAMES[locale]}</span>
    </button>
  {/snippet}
</DockMenu>

<style>
  /* The language shown now, beside the item that changes it. */
  .value {
    color: var(--muted);
    font-size: var(--text-small);
  }
</style>
