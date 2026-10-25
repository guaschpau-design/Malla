// The LoRa radio of this device: connecting it, giving it the active group's channel, and
// feeding the group's events through the airtime scheduler (ARCHITECTURE.md §4.2–4.3).

import { LIMITS, LoraScheduler } from '@teselia/core';
import {
  MeshCoreRadio,
  RadioError,
  webBleConnector,
  type RadioLink,
  type RadioLinkState,
} from '@teselia/meshcore';

import type { AppDb } from '../storage/app-db.ts';
import type { GroupFeed, LoraSink } from '../sync/group-feed.svelte.ts';
import { loadRadioTexts, saveRadioText, type StoredRadioText } from './radio-texts.ts';

/** What the radio needs from the active group's feed. */
export type RadioFeed = Pick<GroupFeed, 'attachRadio' | 'receiveFromRadio' | 'radioChannel'>;

export type RadioProblem = 'unsupported' | 'no-free-channel' | 'no-answer' | 'failed';

/** How often the scheduler is asked for the next packet. */
const PUMP_MS = 1000;

export class RadioSession {
  state: RadioLinkState = $state('disconnected');
  name: string | null = $state(null);
  /** True once the group's channel is configured: events flow both ways. */
  linked = $state(false);
  problem: RadioProblem | null = $state(null);
  /** Signal-to-noise ratio of the last packet received, in dB. */
  lastSnr: number | null = $state(null);
  /** Share of the legal airtime (10 % of an hour) used in the last hour, 0 to 1. */
  airtimeUsed = $state(0);
  /** Text messages of other MeshCore apps, oldest first. */
  texts: readonly StoredRadioText[] = $state.raw([]);

  readonly #link: RadioLink;
  readonly #scheduler: LoraScheduler;
  #feed: RadioFeed | null = null;
  #db: AppDb | null = null;
  #pump: ReturnType<typeof setInterval> | null = null;
  #sending = false;
  readonly #sink: LoraSink = {
    offer: (packet, source) => {
      this.#scheduler.offer(packet, source, Date.now());
    },
    heard: (event) => {
      this.#scheduler.heard(event, Date.now());
    },
  };

  constructor(link: RadioLink = new MeshCoreRadio(webBleConnector), random = Math.random) {
    this.#link = link;
    this.#scheduler = new LoraScheduler({ random });
    link.onStateChange((state) => {
      this.state = state;
      this.name = link.name;
      if (state === 'disconnected') this.#unlink();
    });
    link.onReceive((frame) => {
      this.lastSnr = frame.snr;
      void this.#feed?.receiveFromRadio(frame.bytes);
    });
    link.onText((text) => {
      const stored = { ...text, receivedAt: Date.now() };
      this.texts = [...this.texts, stored];
      if (this.#db) void saveRadioText(this.#db, stored);
    });
  }

  /** Where heard MeshCore text messages are kept; loads those kept before. */
  async useStorage(db: AppDb): Promise<void> {
    this.#db = db;
    this.texts = [...(await loadRadioTexts(db)), ...this.texts];
  }

  /** Asks the user to pick a radio, connects and links it to the active group. */
  async connect(): Promise<void> {
    this.problem = null;
    try {
      await this.#link.connect();
    } catch (error) {
      // Closing the browser's picker is not a problem worth reporting.
      if (!(error instanceof DOMException && error.name === 'NotFoundError')) {
        console.warn('Radio connection failed', error);
        this.problem = 'failed';
      }
      return;
    }
    await this.#linkFeed();
  }

  async disconnect(): Promise<void> {
    await this.#link.disconnect();
  }

  /** Follows the active group: its channel goes into the radio and its events through it. */
  async useFeed(feed: RadioFeed | null): Promise<void> {
    this.#unlink();
    this.#feed = feed;
    await this.#linkFeed();
  }

  async #linkFeed(): Promise<void> {
    const feed = this.#feed;
    if (feed === null || this.#link.state !== 'ready') return;
    const { name, secret } = feed.radioChannel;
    try {
      await this.#link.configureGroupChannel(name, secret);
    } catch (error) {
      this.problem = problemOf(error);
      return;
    }
    if (this.#feed !== feed) return; // The active group changed meanwhile.
    feed.attachRadio(this.#sink);
    this.linked = true;
    this.#pump ??= setInterval(() => void this.#sendNext(), PUMP_MS);
  }

  #unlink(): void {
    this.#feed?.attachRadio(null);
    this.linked = false;
    if (this.#pump !== null) clearInterval(this.#pump);
    this.#pump = null;
  }

  async #sendNext(): Promise<void> {
    if (this.#sending || !this.linked) return;
    const now = Date.now();
    const packet = this.#scheduler.next(now);
    this.airtimeUsed = this.#scheduler.spentMs(now) / LIMITS.urgentBudgetMs;
    if (packet === null) return;
    this.#sending = true;
    try {
      const outcome = await this.#link.send(packet.bytes);
      if (outcome.status === 'failed') this.#scheduler.retry(packet, Date.now());
    } finally {
      this.#sending = false;
    }
  }
}

function problemOf(error: unknown): RadioProblem {
  if (error instanceof RadioError) {
    if (error.code === 'no-free-channel') return 'no-free-channel';
    if (error.code === 'timeout') return 'no-answer';
  }
  return 'failed';
}
