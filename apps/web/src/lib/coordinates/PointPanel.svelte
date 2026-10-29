<!-- A point of the map, picked by a long press, found by its coordinates or tapped as a public
     service: how far it is from here, what else is known of it and what can be done there first,
     then its coordinates, small, to copy. -->
<script lang="ts">
  import type { LatLon } from '@tesel/protocol';
  import type { Snippet } from 'svelte';

  import type { Locale, Translate } from '../i18n/index.ts';
  import FromHere from '../navigation/FromHere.svelte';
  import type { Preference } from '../settings/preference.svelte.ts';
  import type { Action } from '../ui/action.ts';
  import Actions from '../ui/Actions.svelte';
  import Panel from '../ui/Panel.svelte';
  import CoordinateLine from './CoordinateLine.svelte';
  import type { CoordinateFormat } from './coordinates.ts';

  interface Props {
    t: Translate;
    locale: Locale;
    /** "Map point", or the name of the service tapped. */
    title: string;
    at: LatLon;
    format: Preference<CoordinateFormat>;
    onnavigate: () => void;
    /** Present when the point can be marked for the group. */
    onmark: (() => void) | null;
    /** Present when a task can be added there for the group. */
    ontask: (() => void) | null;
    onclose: () => void;
    /** What else is known of the point, such as the weather warnings there. */
    about?: Snippet;
  }

  let { t, locale, title, at, format, onnavigate, onmark, ontask, onclose, about }: Props =
    $props();

  const actions: Action[] = $derived([
    { icon: 'heading', label: t('guideMe'), run: onnavigate },
    ...(onmark ? [{ icon: 'pin', label: t('markHere'), run: onmark } as const] : []),
    ...(ontask ? [{ icon: 'task', label: t('taskHere'), run: ontask } as const] : []),
  ]);
</script>

<Panel {title} closeLabel={t('close')} {onclose}>
  <div class="stack section">
    <FromHere {t} {locale} {at} />
    <Actions {actions} moreLabel={t('moreActions')} />
    {@render about?.()}
    <CoordinateLine {t} {at} {format} />
  </div>
</Panel>
