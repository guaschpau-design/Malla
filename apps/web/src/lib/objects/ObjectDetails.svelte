<!-- What a map object is, who last changed it, and deleting it for the whole group. -->
<script lang="ts">
  import type { GroupState } from '@tesel/core';
  import type { LatLon } from '@tesel/protocol';

  import CoordinateBlock from '../coordinates/CoordinateBlock.svelte';
  import type { CoordinateFormat } from '../coordinates/coordinates.ts';
  import { formatTime } from '../format.ts';
  import type { Locale, Translate } from '../i18n/index.ts';
  import { aliasOf } from '../incidents/incidents.ts';
  import type { Preference } from '../settings/preference.svelte.ts';
  import Panel from '../ui/Panel.svelte';
  import { styleInfo, symbolInfo } from './catalog.ts';

  interface Props {
    t: Translate;
    locale: Locale;
    groupState: GroupState;
    objectKey: string;
    format: Preference<CoordinateFormat>;
    ondelete: () => Promise<void>;
    onclose: () => void;
  }

  let { t, locale, groupState, objectKey, format, ondelete, onclose }: Props = $props();

  const record = $derived(groupState.objects.get(objectKey));
  const kindName = $derived.by(() => {
    if (record?.type === 'marker') return t(symbolInfo(record.symbol).label);
    if (record?.type === 'shape') return t(styleInfo(record.style).label);
    return '';
  });
  /** Where the object is, when it is at one point: a marker, or a circle's centre. */
  const at: LatLon | null = $derived.by(() => {
    if (record?.type === 'marker') return { lat: record.lat, lon: record.lon };
    if (record?.type === 'shape' && record.geometry.kind === 'circle')
      return record.geometry.center;
    return null;
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
      <p>{kindName}</p>
      {#if at}<CoordinateBlock {t} {at} {format} />{/if}
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
