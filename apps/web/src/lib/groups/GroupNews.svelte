<!-- Tells whoever coordinates, in a short notice, what is new in the group (group-news.ts): who
     joins, in one notice for those who join together, a situation report, a task started or
     finished. What the group held when it opened is not news. -->
<script lang="ts">
  import type { NodeId } from '@tesel/protocol';
  import { untrack } from 'svelte';

  import type { Locale, Translate } from '../i18n/index.ts';
  import { aliasOf } from '../members/alias.ts';
  import { reportLines } from '../reports/report-summary.ts';
  import { notices } from '../ui/notices.svelte.ts';
  import { groupNews, type NewsState } from './group-news.ts';

  interface Props {
    t: Translate;
    locale: Locale;
    state: NewsState;
    self: NodeId;
  }

  let { t, locale, state, self }: Props = $props();

  let seen = untrack(() => ({
    members: state.members,
    reports: state.reports,
    tasks: state.tasks,
  }));

  $effect(() => {
    const now = { members: state.members, reports: state.reports, tasks: state.tasks };
    const news = groupNews(seen, now, self, Date.now() / 1000);
    seen = now;
    const joined = news.flatMap((item) => (item.kind === 'joined' ? [aliasOf(now, item.who)] : []));
    if (joined.length > 0) {
      const names = new Intl.ListFormat(locale).format(joined);
      notices.show(t(joined.length === 1 ? 'newsJoinedOne' : 'newsJoinedMany', { names }));
    }
    for (const item of news) {
      if (item.kind === 'report') {
        const lines = reportLines(item.report, t);
        const report = [lines.incident, lines.casualties].filter(Boolean).join(' · ');
        notices.show(t('newsReport', { name: aliasOf(now, item.report.origin), report }));
      }
      if (item.kind === 'task') {
        const { origin, status, text } = item.task;
        const key = status === 'done' ? 'newsTaskDone' : 'newsTaskStarted';
        notices.show(t(key, { name: aliasOf(now, origin), text }));
      }
    }
  });
</script>
