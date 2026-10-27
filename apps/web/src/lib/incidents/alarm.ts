// Making sure an SOS, a critical alert or a roll call is noticed: the phone vibrates (not on the
// iPhone, whose browsers have no vibration), a tone sounds, and, while the app is not on screen,
// the system shows a notification the user can tap to come back.

/** What an alarm says when it shows as a system notification. */
export interface AlarmMessage {
  readonly title: string;
  readonly body: string;
  /** Notifications with the same tag replace each other instead of piling up. */
  readonly tag: string;
}

export interface AlarmChoices {
  readonly sound: boolean;
  readonly notifications: boolean;
}

/** Two-tone beeps, three times: short enough not to annoy, hard to miss. */
const TONES_HZ = [880, 660] as const;
const BEEP_S = 0.18;
const REPEATS = 3;
const VIBRATION_MS = [300, 150, 300, 150, 300];

let audio: AudioContext | null = null;

/**
 * Browsers play sound only after the user has touched the page. Call this once at start: the
 * first touch prepares the audio, so that a later alarm can sound with no touch.
 */
export function prepareAlarmSound(): () => void {
  const prepare = () => {
    audio ??= new AudioContext();
    void audio.resume();
  };
  window.addEventListener('pointerdown', prepare, { once: true, capture: true });
  return () => {
    window.removeEventListener('pointerdown', prepare, { capture: true });
  };
}

export function raiseAlarm(message: AlarmMessage, choices: AlarmChoices): void {
  if ('vibrate' in navigator) navigator.vibrate(VIBRATION_MS);
  if (choices.sound) playTone();
  if (choices.notifications && document.visibilityState === 'hidden') void notify(message);
}

function playTone(): void {
  if (audio === null || audio.state !== 'running') return;
  const start = audio.currentTime;
  for (let index = 0; index < REPEATS * TONES_HZ.length; index++) {
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.type = 'square';
    oscillator.frequency.value = TONES_HZ[index % TONES_HZ.length] ?? TONES_HZ[0];
    const at = start + index * BEEP_S * 1.2;
    gain.gain.setValueAtTime(0.25, at);
    gain.gain.setValueAtTime(0, at + BEEP_S);
    oscillator.connect(gain).connect(audio.destination);
    oscillator.start(at);
    oscillator.stop(at + BEEP_S);
  }
}

/** Whether system notifications can be shown here at all. */
export const notificationsSupported = typeof window !== 'undefined' && 'Notification' in window;

/** Asks the user to allow notifications; true if they are allowed. Call it from a tap. */
export async function allowNotifications(): Promise<boolean> {
  if (!notificationsSupported) return false;
  if (Notification.permission === 'granted') return true;
  return (await Notification.requestPermission()) === 'granted';
}

async function notify({ title, body, tag }: AlarmMessage): Promise<void> {
  if (!notificationsSupported || Notification.permission !== 'granted') return;
  const options: NotificationOptions = { body, tag, requireInteraction: true };
  // Through the service worker where there is one: the only way on Android.
  // (Missing outside a secure context, whatever the types say.)
  const registration =
    'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : undefined;
  if (registration) await registration.showNotification(title, options);
  else new Notification(title, options);
}
