# 0002. A progressive web app is the only client in v0.1

- Status: Superseded after v0.1 by [0016](0016-web-app-and-native-shells.md)
- Date: 2026-10-25

## Context

The client must run on Android, iOS and desktops, work offline and talk to LoRa radios. The first usable version is due in one week. Native apps per platform would multiply the work and require app-store accounts and review.

Web Bluetooth and Web Serial, needed to reach the radio, are available in Chromium browsers (Chrome, Edge) on Android, Windows, macOS and Linux, but not in Safari on iOS.

## Decision

Build a single installable progressive web app (PWA) with offline support. It runs everywhere; the LoRa link is available wherever the browser supports Web Bluetooth. iPhones use the internet link or a local command post over Wi-Fi.

## Consequences

- One codebase, no app stores, instant updates.
- No LoRa on iPhone in v0.1. A thin native wrapper may be added later without rewriting the app.
- The app must be installed and prepared (group joined, maps downloaded, radio paired) while internet is still available. The app guides users through this.
- PWAs require HTTPS, which matters for the local command post (see ADR-0008).
