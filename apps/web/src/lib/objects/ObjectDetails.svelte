<!-- What a map object is, who last changed it, and deleting it for the whole group. -->
<script lang="ts">
  import { areaSquareMeters, pathMeters, type GroupState } from '@tesel/core';

  import CoordinateBlock from '../coordinates/CoordinateBlock.svelte';
  import type { CoordinateFormat } from '../coordinates/coordinates.ts';
  import { formatArea, formatDistance, formatTime } from '../format.ts';
  import type { Locale, Translate } from '../i18n/index.ts';
  import { aliasOf } from '../incidents/incidents.ts';
  import FromHere from '../navigation/FromHere.svelte';
  import { objectPosition } from '../navigation/target.ts';
  import type { DeviceLocation } from '../position/device-location.svelte.ts';
  import type { Preference } from '../settings/preference.svelte.ts';
  import Panel from '../ui/Panel.svelte';
  import { styleInfo, symbolInfo } from './catalog.ts';

  interface Props {
    t: Translate;
    locale: Locale;
    groupState: GroupState;
    objectKey: string;
    format: Preference<CoordinateFormat>;
    location: DeviceLocation;
    /** Guide this device there; the name says where to. */
    onnavigate: (name: string) => void;
    ondelete: () => Promise<void>;
    onclose: () => void;
  }

  let { t, locale, groupState, objectKey, format, location, onnavigate, ondelete, onclose }: Props =
    $props();

  const record = $derived(groupState.objects.get(objectKey));
  const kindName = $derived.by(() => {
    if (record?.type === 'marker') return t(symbolInfo(record.symbol).label);
    if (record?.type === 'shape') return t(styleInfo(record.style).label);
    return '';
  });
  const at = $derived(objectPosition(groupState, objectKey));
  /** What can be measured of a line, an area or a circle. */
  const measure = $derived.by(() => {
    if (record?.type !== 'shape') return null;
    const { geometry } = record;
    switch (geometry.kind) {
      case 'polyline':
        return formatDistance(pathMeters(geometry.points), locale);
      case 'polygon':
        return formatArea(areaSquareMeters(geometry.points), locale);
      case 'circle':
        return t('measureRadius', { radius: formatDistance(geometry.radius, locale) });
    }
  });
  const title = $derived(
    record && record.type !== 'object-delete' && record.label ? record.label : kindName,
  );

  async function remove(): Promise<void> {
    if (!confirm(t('confirmDeleteObject', { name: title }))) return;
    await ondelete();
    onclose();
  }
</script>

{#if record && record.type !== 'object-delete'}
  <Panel {title} closeLabel={t('close')} {onclose}>
    <div class="stack section">
      <p>
        {kindName}{#if measure}&nbsp;· {measure}{/if}
      </p>
      {#if at}
        <CoordinateBlock {t} {at} {format} />
        <FromHere
          {t}
          {locale}
          {at}
          {location}
          onnavigate={() => {
            onnavigate(title);
          }}
        />
      {/if}
      <p class="hint">
        {t('changedBy', {
          name: aliasOf(groupState, record.origin),
          time: formatTime(record.time * 1000, locale),
        })}
      </p>
      <div class="row">
        <button onclick={remove}>{t('delete')}</button>
      </div>
    </div>
  </Panel>
{/if}
