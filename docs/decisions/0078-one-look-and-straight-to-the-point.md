# 0078. One look, and straight to the point

- Status: Accepted
- Date: 2026-10-30

## Context

Used on a phone, a few screens still asked too much. In Me, the LoRa line was a sentence in a box ("No LoRa radio: without coverage you cannot reach the group") that took more room than anything else and read as a warning. The top bar showed the group's name in a plain box on the right, which did not say it was the group. The name picked on first launch could not be changed: the protocol always allowed it (MEMBER_INFO carries the alias, and the latest wins), but nothing in the app offered it. The report form showed four casualty counters, eight buttons, before the optional parts, all folded. The diary opened on two paragraphs explaining it and its log. And the same pieces were drawn in several ways: six copies of the chip and its "chosen" outline with different sizes, five resets of `fieldset` and `legend`, two ways of picking a file, and two kinds of disclosure besides `Fold`.

## Decision

- **Me** opens on the person's name, with a pencil beside it that changes it (`Session.renameIdentity`, `GroupFeed.rename`, which tells the open group at once; other groups learn it as they are next opened). The field is the one of the first launch (`AliasField`). The open group's feed is not opened again for a new name.
- The **LoRa radio** is one line of the sheet like the battery's: "LoRa radio · Linked", or "Not linked" with "Connect" beside it in Me.
- The **coordinate format** moves to Settings: it changes the whole app, not this person.
- The **top bar** reads left to right: the logo, the group in use, under the word "Group" and with a chevron that says it opens, and on the right how this device is connected. Both buttons are the same height and edge.
- The **report form** folds the casualties like the dangers, the access and the help needed, with the counts as the gist ("Red 1 · Green 2"). Only what happens is in view.
- The **diary** has no introduction: "Download" and the lines. The log to save or load waits folded under "Encrypted log". Other introductions (offline maps, typed coordinates, MeshCore) are cut to one short sentence.
- **Shared pieces**, in `app.css`: `.chips` and `.chip` for choices as pills, `.segments` for two or three choices as parts of one row, one "chosen" outline for both, `fieldset` and `legend`, and `button.small` for an action inside a line. A file is picked with a button that opens a hidden file input; a folded part is a `Fold`, whose chevron is the top bar's.

This amends [ADR-0069](0069-who-keeps-in-touch-without-coverage.md), [ADR-0070](0070-a-simpler-app.md) and [ADR-0071](0071-panels-read-whole.md).

## Consequences

- Me reads as a list of short lines, the same as a teammate's card; who has a radio is still seen at a glance, though no longer explained there (the guide does).
- A name can be corrected or completed after the first launch; the diary already says "Now goes by…" when it changes.
- A component that needs a chip, a segment or a fieldset takes the shared class and adds only what is its own.
