# Supported radios

Tesel talks to a MeshCore radio running the **Companion Bluetooth** firmware (v1.18 or later), as described in [`protocol.md`](protocol.md) §7. These are the devices the project supports and tests in v0.1.

| Device                  | MCU · LoRa chip   | Screen and keyboard    | Firmware to flash                    | Notes                                                                                                                        |
| ----------------------- | ----------------- | ---------------------- | ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| SenseCAP T1000-E        | nRF52840 · LR1110 | None                   | `t1000e_companion_radio_ble`         | Card-sized, sealed, low power. The reference companion.                                                                      |
| SenseCAP MeshTracker X1 | nRF52 · LR2021    | None                   | `MeshTracker_X1_companion_radio_ble` | Newest radio chip; LR2021 driver fixes landed in MeshCore v1.18.                                                             |
| LilyGO T-Deck Plus      | ESP32-S3 · SX1262 | Screen, keyboard, GPS  | `LilyGo_TDeck_companion_radio_ble`   | In companion mode the screen shows status only; the keyboard is not used.                                                    |
| Elecrow ThinkNode M9    | ESP32-S3 · LR1110 | Screen, keyboard, GNSS | `ThinkNode_M9_companion_radio_ble_`  | Ships with Ripple UI; it must be reflashed with the companion build to work with Tesel. A Wi-Fi companion build also exists. |

## What "companion mode" means for keyboard devices

The T-Deck Plus and the ThinkNode M9 can work on their own, typing on their keyboards, with standalone firmware (Ripple or vendor UIs). Tesel needs them in **companion mode** instead, where the phone or computer is the interface and the device is the radio. A device runs one firmware at a time:

- Companion firmware: works with Tesel; its own keyboard is not used.
- Standalone firmware: works on its own; Tesel cannot talk to it.

Using these devices as standalone Tesel terminals would need Tesel firmware on the device itself, which is out of scope for v0.1.

## Flashing

1. Open the official MeshCore web flasher, <https://flasher.meshcore.io>, in Chrome or Edge.
2. Connect the device by USB and select it.
3. Choose **Companion Bluetooth** and the latest version.
4. nRF52 devices (T1000-E, MeshTracker X1) need DFU mode; follow the flasher's prompt. Erase before the first flash.
5. After flashing, set the region to EU 868 (preset EU/UK Narrow) in the MeshCore app or Tesel.

## Connecting

Web Bluetooth is available in Chrome and Edge on Android, Windows, macOS and Linux. It is not available in Safari, so iPhones cannot pair with a radio from the web app (see ADR-0002).

1. Join or create the group first: the radio carries the active group.
2. Tap **LoRa** in the top bar, then **Connect radio**, and pick the radio in the browser's list.
3. Tesel stores the group secret in a free channel slot of the radio (it never overwrites another channel) and starts sending and receiving. The panel shows the last signal-to-noise ratio and the airtime used in the last hour.

While connected, Tesel reads every message the radio holds. Text messages of other MeshCore apps appear in the chat's MeshCore tab, read-only; disconnect in the panel to reply from the MeshCore app.
