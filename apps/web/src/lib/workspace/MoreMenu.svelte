<!-- The dock's "More" menu: what is used now and then, with or without a group. -->
<script lang="ts">
  import {
    LOCALE_NAMES,
    nextLocale,
    type LanguageChoice,
    type Locale,
    type MessageKey,
    type Translate,
  } from '../i18n/index.ts';
  import type { Preference } from '../settings/preference.svelte.ts';
  import DockMenu from '../ui/DockMenu.svelte';
  import {
    enterFullscreen,
    exitFullscreen,
    fullscreenSupported,
    fullscreenView,
  } from '../ui/fullscreen.svelte.ts';
  import type { GlyphName } from '../ui/glyphs.ts';
  import { panels } from '../ui/panels.svelte.ts';
  import Pictogram from '../ui/Pictogram.svelte';
  import { screenWakeSupported } from '../ui/screen-awake.svelte.ts';
  import Switch from '../ui/Switch.svelte';

  interface Props {
    t: Translate;
    onmeasure: () => void;
    keepScreenOn: Preference<boolean>;
    /** Whether the app goes full screen in a browser tab. */
    fullscreen: Preference<boolean>;
    language: Preference<LanguageChoice>;
    /** The language shown now. */
    locale: Locale;
    /** The diary is the active group's. */
    withGroup: boolean;
  }

  let { t, onmeasure, keepScreenOn, fullscreen, language, locale, withGroup }: Props = $props();

  /** Now and on every later visit, until switched off again. */
  function toggleFullscreen(): void {
    const on = !fullscreenView.active;
    if (on) enterFullscreen();
    else exitFullscreen();
    void fullscreen.set(on);
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
    {#if screenWakeSupported}
      <!-- The menu stays open, so the switch is seen to change. -->
      <button
        role="menuitemcheckbox"
        aria-checked={keepScreenOn.value}
        onclick={() => void keepScreenOn.set(!keepScreenOn.value)}
      >
        <Pictogram name="screen" size={20} />
        {t('keepScreenOn')}
        <Switch on={keepScreenOn.value} />
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
    <!-- The next language, round the list; the menu stays open, so the change is seen. -->
    <button role="menuitem" onclick={() => void language.set(nextLocale(locale))}>
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
