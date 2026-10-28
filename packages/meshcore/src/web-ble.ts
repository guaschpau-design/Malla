// Connecting to a MeshCore radio over Web Bluetooth (Chrome and Edge; not Safari or Firefox).

// Only the Web Bluetooth entry point of meshcore.js is imported, so its Node-only serial code
// never reaches the browser bundle.
// @ts-expect-error -- meshcore.js ships no type declarations; the shape is declared below.
import untypedWebBleConnection from '@liamcottle/meshcore.js/src/connection/web_ble_connection.js';

import type { CompanionConnection } from './companion.ts';
import type { Connector, OpenedRadio } from './meshcore-radio.ts';

interface WebBleConnection extends CompanionConnection {
  readonly bleDevice: BleDevice;
}

/** The Web Bluetooth device the user picked: meshcore.js connects to it on construction. */
interface BleDevice {
  readonly name?: string;
}

const WebBle = untypedWebBleConnection as {
  new (device: BleDevice): WebBleConnection;
  open(): Promise<WebBleConnection | null | undefined>;
};

/** How long the radio has to finish connecting once the user has picked it. */
const CONNECT_TIMEOUT_MS = 20_000;

/**
 * Shows the browser's Bluetooth picker and resolves once the radio is ready for commands. The
 * same device is opened again without the picker when the connection drops.
 */
export const webBleConnector: Connector = async () => {
  const connection = await WebBle.open();
  if (!connection) throw new Error('no radio selected');
  return ready(connection);
};

async function ready(connection: WebBleConnection): Promise<OpenedRadio> {
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('the radio did not finish connecting'));
    }, CONNECT_TIMEOUT_MS);
    connection.on('connected', () => {
      clearTimeout(timer);
      resolve();
    });
  });
  const device = connection.bleDevice;
  return { connection, name: device.name ?? null, reopen: () => ready(new WebBle(device)) };
}
