// Plays a scenario on a group: one simulated device per member, each event sent when its moment
// comes, or everything at once for a short scenario that should already have happened.

import { deriveGroupKeys, type EventRef } from '@tesel/protocol';

import { SimulatedDevice, type EventDraft } from './device.ts';
import { plan, type PlannedAction, type Scenario } from './scenario.ts';

export interface PlayOptions {
  /** Base URL of the group's server. */
  readonly server: string;
  /** The group's secret, as its invitation carries it. */
  readonly secret: Uint8Array;
  /**
   * How many times faster than real time. `Infinity` sends everything at once, dated as if it had
   * happened over the scenario's duration until now; the relay's limits (protocol §8) make that
   * practical for scenarios of a few hundred events.
   */
  readonly speed: number;
  /** Seconds between position reports of each member. */
  readonly positionEvery: number;
  readonly log?: (line: string) => void;
}

const ACCURACY_M = 6;

export async function play(scenario: Scenario, options: PlayOptions): Promise<void> {
  const events = plan(scenario, { positionEvery: options.positionEvery });
  const keys = deriveGroupKeys(options.secret);
  const devices = new Map<string, SimulatedDevice>();
  for (const member of scenario.members) {
    devices.set(member.alias, await SimulatedDevice.connect(options.server, keys));
  }
  /** References of the objects and SOS calls the scenario names. */
  const named = new Map<string, EventRef>();
  const instant = !Number.isFinite(options.speed);
  const startMs = Date.now();
  const startTime = Math.floor(startMs / 1000) - (instant ? scenario.duration : 0);
  try {
    for (const event of events) {
      if (!instant) await waitUntil(startMs + (event.at * 1000) / options.speed);
      const device = devices.get(event.by);
      if (device === undefined) throw new Error(`no device for ${event.by}`);
      const time = instant ? startTime + event.at : Math.floor(Date.now() / 1000);
      const draft = draftOf(event.action, event.by, device, named);
      const ref = await device.publish(draft, time);
      if ('id' in event.action) named.set(event.action.id, ref);
      if (event.action.type !== 'position') options.log?.(`${event.by}: ${event.action.type}`);
    }
  } finally {
    for (const device of devices.values()) device.close();
  }
}

function draftOf(
  action: PlannedAction,
  alias: string,
  device: SimulatedDevice,
  named: ReadonlyMap<string, EventRef>,
): EventDraft {
  const ref = (id: string): EventRef => {
    const found = named.get(id);
    if (found === undefined) throw new Error(`${action.type} refers to ${id}, not sent yet`);
    return found;
  };
  switch (action.type) {
    case 'announce':
      return (header) => ({
        ...header,
        type: 'member-info',
        role: action.role,
        publicKey: device.identity.publicKey,
        alias,
      });
    case 'position':
      return (header) => ({
        ...header,
        type: 'position',
        ...action.where,
        accuracy: ACCURACY_M,
        heading: null,
        speed: null,
      });
    case 'chat':
      return (header) => ({ ...header, type: 'chat', text: action.text });
    case 'alert':
      return (header) => ({ ...header, type: 'alert', level: action.level, text: action.text });
    case 'marker':
      return (header) => ({
        ...header,
        type: 'marker',
        object: { origin: header.origin, seq: header.seq },
        symbol: action.symbol,
        label: action.label,
        ...action.where,
      });
    case 'shape':
      return (header) => ({
        ...header,
        type: 'shape',
        object: { origin: header.origin, seq: header.seq },
        style: action.style,
        label: action.label,
        geometry: action.geometry,
      });
    case 'sos':
      return (header) => ({
        ...header,
        type: 'sos',
        kind: action.kind,
        ...action.where,
        accuracy: ACCURACY_M,
        text: action.text,
      });
    case 'ack': {
      const target = ref(action.of);
      return (header) => ({ ...header, type: 'ack', target });
    }
    case 'cancel-sos': {
      const sos = ref(action.of);
      return (header) => ({ ...header, type: 'sos-cancel', sos });
    }
  }
}

function waitUntil(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, ms - Date.now())));
}
