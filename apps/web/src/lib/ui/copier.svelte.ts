// Copying a text to the clipboard, and saying so for a moment: what every copy button does.

import { attempt } from './submission.svelte.ts';

/** How long "copied" shows, in milliseconds. */
const COPIED_MS = 2000;

export class Copier {
  /** The text went to the clipboard a moment ago. */
  copied = $state(false);

  /** Copies `text`; if the browser refuses the clipboard, `failed` is shown in a notice. */
  copy(text: string, failed: string): void {
    attempt(async () => {
      await navigator.clipboard.writeText(text);
      this.copied = true;
      setTimeout(() => (this.copied = false), COPIED_MS);
    }, failed);
  }
}
