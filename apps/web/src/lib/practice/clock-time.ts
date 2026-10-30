// A span of seconds as a clock shows it: "07:05".

/** Minutes and seconds, two figures each: how long an exercise has run, or when something happened. */
export function clockTime(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds));
  const [minutes, rest] = [Math.floor(whole / 60), whole % 60];
  return `${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`;
}
