<!-- What a map object is, who last changed it, and deleting it for the whole group. -->
<script lang="ts">
  import { areaSquareMeters, pathMeters, type GroupState } from '@tesel/core';
  import type { LatLon } from '@tesel/protocol';

  import CoordinateBlock from '../coordinates/CoordinateBlock.svelte';
  import type { CoordinateFormat } from '../coordinates/coordinates.ts';
  import { formatArea, formatDistance, formatTime } from '../format.ts';
  import type { Locale, Translate } from '../i18n/index.ts';
  import { aliasOf } from '../members/alias.ts';
  import FromHere from '../navigation/FromHere.svelte';
  import { objectPosition } from '../navigation/target.ts';
  import type { DeviceLocation } from '../position/device-location.svelte.ts';
  import type { Preference } from '../settings/preference.svelte.ts';
  import ActionButton from '../ui/ActionButton.svelte';
  import { confirmations } from '../ui/confirmations.svelte.ts';
  import Panel from '../ui/Panel.svelte';
  import { objectKind } from './catalog.ts';
  import { attempt } from '../ui/submission.svelte.ts';

  interface Props {
    t: Translate;
    locale: Locale;
    groupState: GroupState;
    objectKey: string;
    format: Preference<CoordinateFormat>;
    location: DeviceLocation;
    /** Guide this device there; the name says where to. */
    onnavigate: (name: string) => void;
    /** Starts a task at the object's place. */
    ontask: (at: LatLon) => void;
    ondelete: () => Promise<void>;
    onclose: () => void;
  }

  let {
    t,
    locale,
    groupState,
    objectKey,
    format,
    location,
    onnavigate,
    ontask,
    ondelete,
    onclose,
  }: Props = $props();

  const record = $derived(groupState.objects.get(objectKey));
  const kindName = $derived(record && record.type !== 'object-delete' ? t(objectKind(record)) : '');
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
    const text = t('confirmDeleteObject', { name: title });
    if (!(await confirmations.ask({ text, confirm: t('delete') }))) return;
    attempt(async () => {
      await ondelete();
      onclose();
    }, t('actionFailed'));
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
        <FromHere {t} {locale} {at} {location} />
      {/if}
      <p class="hint">
        {t('changedBy', {
          name: aliasOf(groupState, record.origin),
          time: formatTime(record.time * 1000, locale),
        })}
      </p>
      <div class="row">
        {#if at}
          {@const place = at}
          <ActionButton
            icon="heading"
            label={t('guideMe')}
            onclick={() => {
              onnavigate(title);
            }}
          />
          <ActionButton
            icon="task"
            label={t('taskHere')}
            onclick={() => {
              ontask(place);
            }}
          />
        {/if}
        <button onclick={remove}>{t('delete')}</button>
      </div>
    </div>
  </Panel>
{/if}
