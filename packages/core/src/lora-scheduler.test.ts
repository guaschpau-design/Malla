import type { NodeId, TeseliaEvent } from '@teselia/protocol';
import { describe, expect, it } from 'vitest';

import { LIMITS, LoraScheduler, type LoraPacket } from './lora-scheduler.ts';

const ME = 'a1b2c3d4' as NodeId;
const OTHER = '0f1e2d3c' as NodeId;
const T0 = 1_761_350_400;
const VALENCIA = { lat: 39.4699, lon: -0.3763 };

let seq = 0;
function packet(event: Omit<TeseliaEvent, 'seq' | 'time'> & Partial<TeseliaEvent>): LoraPacket {
  seq++;
  return { event: { seq, time: T0, ...event } as TeseliaEvent, bytes: new Uint8Array(40) };
}

const chat = (origin = ME) => packet({ type: 'chat', origin, text: 'hola' });
const position = (at = VALENCIA, origin = ME) =>
  packet({ type: 'position', origin, ...at, accuracy: 5, heading: null, speed: null });
const sos = () =>
  packet({ type: 'sos', origin: ME, kind: 'medical', ...VALENCIA, accuracy: 5, text: '' });

/** A scheduler where every packet costs 1 s of airtime and randomness is fixed. */
const scheduler = (random = 0) =>
  new LoraScheduler({ random: () => random, airtimeMs: () => 1000 });

/** Calls `next` until it returns nothing, collecting the event types sent. */
function drain(lora: LoraScheduler, now: number): string[] {
  const sent: string[] = [];
  for (let packet = lora.next(now); packet !== null; packet = lora.next(now))
    sent.push(packet.event.type);
  return sent;
}

describe('LoRa scheduler', () => {
  it('sends the most urgent event first', () => {
    const lora = scheduler();
    lora.offer(position(), 'own', 0);
    lora.offer(chat(), 'own', 0);
    lora.offer(packet({ type: 'alert', origin: ME, level: 'critical', text: 'Evacuad' }), 'own', 0);
    lora.offer(packet({ type: 'position-hidden', origin: OTHER }), 'own', 0);
    expect(drain(lora, 0)).toEqual(['alert', 'position-hidden', 'chat', 'position']);
  });

  it('never sends the same event twice, nor one already heard on the air', () => {
    const lora = scheduler();
    const message = chat();
    lora.offer(message, 'own', 0);
    lora.offer(message, 'own', 0);
    expect(drain(lora, 0)).toEqual(['chat']);
    lora.offer(message, 'own', 1);
    expect(drain(lora, 1)).toEqual([]);

    const heard = chat(OTHER);
    lora.heard(heard.event, 2);
    lora.offer(heard, 'bridged', 2);
    expect(drain(lora, 20_000)).toEqual([]);
  });

  it('keeps ordinary traffic within half of the legal duty cycle, urgent traffic within all of it', () => {
    const lora = scheduler();
    const normalSlots = LIMITS.normalBudgetMs / 1000;
    for (let i = 0; i < normalSlots + 5; i++) lora.offer(chat(), 'own', 0);
    expect(drain(lora, 0)).toHaveLength(normalSlots);
    lora.offer(packet({ type: 'alert', origin: ME, level: 'warning', text: '!' }), 'own', 0);
    expect(drain(lora, 0)).toEqual(['alert']);
    // An hour later the budget is free again.
    expect(drain(lora, LIMITS.windowMs + 1)).toHaveLength(5);
  });

  it('thins own positions to one every 2 minutes, and only after moving 50 m or 10 minutes', () => {
    const lora = scheduler();
    lora.offer(position(), 'own', 0);
    expect(drain(lora, 0)).toEqual(['position']);

    const nearby = { lat: VALENCIA.lat + 0.0002, lon: VALENCIA.lon }; // about 22 m
    const far = { lat: VALENCIA.lat + 0.001, lon: VALENCIA.lon }; // about 111 m
    lora.offer(position(far), 'own', 60_000);
    expect(drain(lora, 60_000)).toEqual([]); // too soon
    expect(drain(lora, 2 * 60_000)).toEqual(['position']);

    lora.offer(position(nearby), 'own', 3 * 60_000);
    lora.offer(position(far), 'own', 3 * 60_000); // replaces the queued one
    expect(drain(lora, 5 * 60_000)).toEqual([]); // has not moved 50 m from the last sent
    expect(drain(lora, 12 * 60_000)).toEqual(['position']);
  });

  it('drops a queued position when the member hides it', () => {
    const lora = scheduler();
    lora.offer(position(), 'own', 0);
    drain(lora, 0);
    lora.offer(position({ lat: 40, lon: -3 }), 'own', 1000);
    lora.offer(packet({ type: 'position-hidden', origin: ME }), 'own', 1000);
    expect(drain(lora, 10 * 60_000)).toEqual(['position-hidden']);
  });

  it('delays bridged events and skips them if another bridge sends them first', () => {
    const lora = scheduler(0.5);
    const fromServer = chat(OTHER);
    lora.offer(fromServer, 'bridged', 0);
    expect(drain(lora, 4_999)).toEqual([]);
    lora.heard(fromServer.event, 4_000);
    expect(drain(lora, 20_000)).toEqual([]);

    lora.offer(chat(OTHER), 'bridged', 0);
    expect(drain(lora, 5_000)).toEqual(['chat']);
  });

  it('sends bridged positions of a member at most every 5 minutes', () => {
    const lora = scheduler();
    lora.offer(position(VALENCIA, OTHER), 'bridged', 0);
    expect(drain(lora, 0)).toEqual(['position']);
    lora.offer(position({ lat: 40, lon: -3 }, OTHER), 'bridged', 60_000);
    expect(drain(lora, 60_000)).toEqual([]);
    expect(drain(lora, 5 * 60_000)).toEqual(['position']);
  });

  it('repeats an own SOS with growing pauses until someone acknowledges it', () => {
    const lora = scheduler();
    const call = sos();
    lora.offer(call, 'own', 0);
    expect(drain(lora, 0)).toEqual(['sos']);
    expect(drain(lora, 29_999)).toEqual([]);
    expect(drain(lora, 30_000)).toEqual(['sos']);
    expect(drain(lora, 30_000 + 59_999)).toEqual([]);
    expect(drain(lora, 90_000)).toEqual(['sos']);

    lora.observe({ type: 'ack', origin: OTHER, seq: 99, time: T0, target: call.event });
    expect(drain(lora, 60 * 60_000)).toEqual([]);
  });

  it('stops repeating a cancelled SOS', () => {
    const lora = scheduler();
    const call = sos();
    lora.offer(call, 'own', 0);
    drain(lora, 0);
    lora.offer(packet({ type: 'sos-cancel', origin: ME, sos: call.event }), 'own', 1000);
    expect(drain(lora, 60 * 60_000)).toEqual(['sos-cancel']);
  });

  it('waits 2–30 s before acknowledging, and stays quiet if someone else acknowledges first', () => {
    const lora = scheduler(0.5);
    const target = { origin: OTHER, seq: 5 };
    lora.offer(packet({ type: 'ack', origin: ME, target }), 'own', 0);
    expect(drain(lora, 15_999)).toEqual([]);
    lora.heard({ type: 'ack', origin: '630dcd29' as NodeId, seq: 1, time: T0, target }, 10_000);
    expect(drain(lora, 60_000)).toEqual([]);
  });

  it('retries a packet the radio refused, without charging its airtime', () => {
    const lora = scheduler();
    lora.offer(chat(), 'own', 0);
    const sent = lora.next(0);
    if (sent === null) throw new Error('nothing sent');
    lora.retry(sent, 0);
    expect(lora.spentMs(0)).toBe(0);
    expect(drain(lora, LIMITS.retryMs - 1)).toEqual([]);
    expect(drain(lora, LIMITS.retryMs)).toEqual(['chat']);
  });
});
