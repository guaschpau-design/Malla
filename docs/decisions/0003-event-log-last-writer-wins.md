# 0003. Event log with last-writer-wins instead of a CRDT library

- Status: Accepted
- Date: 2026-10-25

## Context

Several devices change shared state while partly or fully disconnected, over links that duplicate, delay and reorder messages. General-purpose CRDT libraries (Yjs, Automerge) solve this, but their update format is opaque and variable in size, and LoRa gives us 165 bytes per packet. Our shared state is simple: positions, chat lines, map objects, alerts. Collaborative editing of the same text is not needed.

## Decision

- Every change is an immutable event identified by `(origin, seq)`.
- State is a pure, idempotent, order-independent function of the set of events.
- Concurrent edits to the same map object resolve by last writer wins, ordered by `(timestamp, origin, seq)`.

## Consequences

- The model is easy to explain, test and implement in another language.
- Each event fits in one LoRa packet.
- Two people editing the same marker at the same moment: one edit wins. Acceptable for our objects.
- Ordering relies on device clocks. Phones are normally synchronised by the network or GPS; badly wrong clocks only affect tie-breaking of concurrent edits, not delivery.
