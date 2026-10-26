// The current time, in seconds, for what a component shows relative to it ("stale", "3 min ago").
// It moves on every `everyMs`; call it while the component initialises.

export function useNow(everyMs: number): { readonly seconds: number } {
  const now = $state({ seconds: Date.now() / 1000 });
  $effect(() => {
    const timer = setInterval(() => (now.seconds = Date.now() / 1000), everyMs);
    return () => {
      clearInterval(timer);
    };
  });
  return now;
}
