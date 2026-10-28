<!-- What a map object is, who last changed it, guidance there or along it, a task at it, and
     deleting it for the whole group. -->
<script lang="ts">
  import { areaSquareMeters, pathMeters, type GroupState } from '@tesel/core';
  import type { TaskPlace } from '@tesel/protocol';

  import CoordinateBlock from '../coordinates/CoordinateBlock.svelte';
  import type { CoordinateFormat } from '../coordinates/coordinates.ts';
  import { formatArea, formatDistance, formatTime } from '../format.ts';
  import type { Locale, Translate } from '../i18n/index.ts';
  import { aliasOf } from '../members/alias.ts';
  import FromHere from '../navigation/FromHere.svelte';
  import { objectDestination } from '../navigation/target.ts';
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
    /** Guide this device there, or along it; the name says where to. */
    onnavigate: (name: string) => void;
    /** Starts a task at the object. */
    ontask: (place: TaskPlace) => void;
    ondelete: () => Promise<void>;
    onclose: () => void;
  }

  let { t, locale, groupState, objectKey, format, onnavigate, ontask, ondelete, onclose }: Props =
    $props();

  const record = $derived(groupState.objects.get(objectKey));
  const kindName = $derived(record && record.type !== 'object-delete' ? t(objectKind(record)) : '');
  const destination = $derived(objectDestination(record));
  const at = $derived(destination?.kind === 'point' ? destination.at : null);
  const isRoute = $derived(destination?.kind === 'route');
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
        <FromHere {t} {locale} {at} />
      {/if}
      <p class="hint">
        {t('changedBy', {
          name: aliasOf(groupState, record.origin),
          time: formatTime(record.time * 1000, locale),
        })}
      </p>
      <div class="row">
        {#if destination}
          <ActionButton
            icon={isRoute ? 'route' : 'heading'}
            label={isRoute ? t('followRoute') : t('guideMe')}
            onclick={() => {
              onnavigate(title);
            }}
          />
        {/if}
        <ActionButton
          icon="task"
          label={isRoute ? t('taskOnRoute') : t('taskHere')}
          onclick={() => {
            ontask({ kind: 'object', object: record.object });
          }}
        />
        <button onclick={remove}>{t('delete')}</button>
      </div>
    </div>
  </Panel>
{/if}
