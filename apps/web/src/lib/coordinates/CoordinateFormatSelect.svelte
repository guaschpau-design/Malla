<!-- How coordinates are written everywhere in the app: degrees, degrees-minutes-seconds, UTM or MGRS.
     One row of Settings, laid out like the switches above it, and remembered. -->
<script lang="ts">
  import type { MessageKey, Translate } from '../i18n/index.ts';
  import type { Preference } from '../settings/preference.svelte.ts';
  import Pictogram from '../ui/Pictogram.svelte';
  import { COORDINATE_FORMATS, type CoordinateFormat } from './coordinates.ts';

  interface Props {
    t: Translate;
    format: Preference<CoordinateFormat>;
  }

  let { t, format }: Props = $props();

  const NAMES: Readonly<Record<CoordinateFormat, MessageKey>> = {
    decimal: 'formatDecimal',
    dms: 'formatDms',
    utm: 'formatUtm',
    mgrs: 'formatMgrs',
  };
</script>

<label class="format">
  <Pictogram name="grid" size={20} />
  <span>{t('coordinateFormat')}</span>
  <select
    value={format.value}
    onchange={(event) => {
      const { value } = event.currentTarget;
      const chosen = COORDINATE_FORMATS.find((option) => option === value);
      if (chosen) void format.set(chosen);
    }}
  >
    {#each COORDINATE_FORMATS as option (option)}
      <option value={option}>{t(NAMES[option])}</option>
    {/each}
  </select>
</label>

<style>
  .format {
    display: grid;
    grid-template-columns: auto 1fr auto;
    gap: 0.75rem;
    align-items: center;
    padding: 0.3rem 0.4rem;
    font-size: inherit;
  }
</style>
