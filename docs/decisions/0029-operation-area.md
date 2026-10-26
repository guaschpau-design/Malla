# 0029. The operation area: an area style that offers its map

- Status: Accepted
- Date: 2026-10-26

## Context

Each member must download the map of the place they will work in before they lose coverage (ADR-0011). Today each one has to remember it, choose the right area and do it; the one who forgets has no map when the network fails. The coordinator knows where the operation is.

## Decision

- A new style code for shapes, `0x0006` "operation area" (protocol §4.2). Adding a style does not change the protocol version, and older receivers draw it as a neutral area.
- Coordinators can choose it when drawing an area (a UI rule, like alerts: ADR-0005).
- Each device that has not downloaded the street map of an operation area yet shows a card on the map with its name and an estimate of its size: "Download" or "Not now". "Not now" lasts until the app restarts.
- The download is the street map, as detailed as fits in one download, at least the detail of a town. Members who also want the topographic or satellite map add them from "Offline maps".

## Consequences

- One tap per member, and the team arrives with the map it needs.
- No new event: the operation area is an ordinary area, changed or deleted like any other object.
- A very large operation area cannot be downloaded at once; the card says so and points to "Offline maps".
- The offline maps panel and the card share one download plan and one download job (`offline/offline-maps.ts`, `offline/download-job.svelte.ts`).
