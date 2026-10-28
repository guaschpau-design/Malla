// This device's battery, where the browser tells it: Chrome and Edge do, on Android and computers;
// Safari and Firefox do not, so on an iPhone it stays unknown.

interface BatteryManager extends EventTarget {
  readonly level: number;
  readonly charging: boolean;
}

type NavigatorWithBattery = Navigator & { getBattery?: () => Promise<BatteryManager> };

class DeviceBattery {
  /** Percent, or null while unknown. */
  percent: number | null = $state(null);
  charging = $state(false);
  /** Whether the browser can tell at all. */
  readonly supported = typeof navigator !== 'undefined' && 'getBattery' in navigator;
  #watching = false;

  /** Starts following the battery; the browser keeps telling until the app closes. */
  watch(): void {
    if (this.#watching || !this.supported) return;
    this.#watching = true;
    (navigator as NavigatorWithBattery)
      .getBattery?.()
      .then((manager) => {
        const read = () => {
          this.percent = Math.round(manager.level * 100);
          this.charging = manager.charging;
        };
        read();
        manager.addEventListener('levelchange', read);
        manager.addEventListener('chargingchange', read);
      })
      .catch((error: unknown) => {
        console.warn('The battery could not be read', error);
      });
  }
}

export const deviceBattery = new DeviceBattery();
