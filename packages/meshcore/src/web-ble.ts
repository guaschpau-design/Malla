// Connecting to a MeshCore radio over Web Bluetooth (Chrome and Edge; not Safari or Firefox).

import WebBleConnection from '@liamcottle/meshcore.js/src/connection/web_ble_connection.js';

import type { Connector } from './meshcore-radio.ts';

/** How long the radio has to finish connecting once the user has picked it. */
const CONNECT_TIMEOUT_MS = 20_000;

export function isWebBluetoothAvailable(): boolean {
  return typeof navigator !== 'undefined' && 'bluetooth' in navigator;
}

/** Shows the browser's Bluetooth picker and resolves once the radio is ready for commands. */
export const webBleConnector: Connector = async () => {
  const connection = await WebBleConnection.open();
  if (!connection) throw new Error('no radio selected');
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('the radio did not finish connecting'));
    }, CONNECT_TIMEOUT_MS);
    connection.on('connected', () => {
      clearTimeout(timer);
      resolve();
    });
  });
  return { connection, name: connection.bleDevice.name ?? null };
};
