// What screen readers hear of what happens on the map without the focus moving there: an SOS,
// entering a danger area. One line, read out each time something is announced, from the app's only
// live region (Announcer.svelte).

class Announcer {
  /** The last announcement, numbered so that the same words said twice are read twice. */
  last: { readonly text: string; readonly id: number } | null = $state.raw(null);

  say(text: string): void {
    this.last = { text, id: (this.last?.id ?? 0) + 1 };
  }
}

export const announcer = new Announcer();
