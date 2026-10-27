# 0040. Dictate chat messages with the browser's speech recognition

- Status: Accepted
- Date: 2026-10-27

## Context

At the critical moment there is often no time, or no free hand, to type a message. Speech recognition reliable in Spanish exists in the platforms the app runs on: Chrome on Android uses Google's, and Safari on iPhone uses Apple's. Both are reached through the Web Speech API, at no cost and with nothing to download. Models that run on the device (Whisper and others) work without a connection, but take tens to hundreds of megabytes and are slow on a phone. Firefox has no speech recognition.

## Decision

- The chat's text box has a microphone. Tapping it starts dictation in the language of the interface (`es-ES` for Spanish). What is heard is written in the box as it comes, after what was typed. Tapping again stops; Send stops and sends.
- Nothing is sent by itself: the dictated text can be read and corrected first, and is sent like any message, encrypted.
- Where the browser has no speech recognition, there is no microphone. When dictation fails, a line says why in terms the user can act on: no permission, no connection, nothing heard, not available.

## Consequences

- Reliable dictation in Spanish with nothing to install, on the phones teams use.
- The voice goes to Google's or Apple's speech service. On most phones dictation therefore needs a connection, and does not work when the group talks over LoRa alone. Recognition on the device is the next step for that case, when it is light enough for a phone.
- Other languages only need their entry in the table of speech languages.
