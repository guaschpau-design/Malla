// Keeps the screen on while `wanted` says so, where the browser can (Screen Wake Lock API). The
// browser drops the lock whenever the app is hidden, so it is asked for again on return. Call it
// while a component initialises.

export const screenWakeSupported = typeof navigator !== 'undefined' && 'wakeLock' in navigator;

export function keepScreenAwake(wanted: () => boolean): void {
  $effect(() => {
    if (!screenWakeSupported || !wanted()) return;
    let lock: WakeLockSentinel | null = null;
    /** A request in flight: returning to the app while it is pending must not ask twice. */
    let requesting = false;
    // Aborted when the screen no longer needs to stay on; a lock granted after that is let go.
    const done = new AbortController();
    const request = async () => {
      if (requesting || document.visibilityState !== 'visible' || (lock && !lock.released)) return;
      requesting = true;
      try {
        const granted = await navigator.wakeLock.request('screen');
        if (done.signal.aborted) await granted.release();
        else lock = granted;
      } catch {
        // Refused, for instance on low battery: the screen simply turns off as usual.
      } finally {
        requesting = false;
      }
    };
    void request();
    document.addEventListener(
      'visibilitychange',
      () => {
        void request();
      },
      { signal: done.signal },
    );
    return () => {
      done.abort();
      void lock?.release();
    };
  });
}
