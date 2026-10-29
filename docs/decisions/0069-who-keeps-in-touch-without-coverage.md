# 0069. Tell who keeps in touch without coverage

- Status: Accepted
- Date: 2026-10-29

## Context

When the mobile network falls, only the members whose app has a LoRa radio linked stay in touch with the group (ADR-0006); the rest are cut off until it comes back. Whoever coordinates needs to know who they are before that happens, to spread the radios across the teams, and each member needs to know which side they are on. The app knew only whose news had reached it by radio lately (ADR-0043), which says nothing of a member who has a radio but whose messages all went through the server. A radio typed in by hand as equipment would be wrong as soon as the radio is unlinked, flat or left in a car.

## Decision

- `MEMBER_STATE` gets one more equipment bit, bit 13: a LoRa radio is linked to the member's app now (protocol §3.14). The app sets it as a radio links and clears it as the radio goes; it is never picked by hand, and the equipment offered to pick does not include it.
- Me and every member's card say it on a line of their own, above the folded sections: with a radio, that the member stays in touch if coverage drops; without one, that they will not, and in Me a button that opens where a radio is linked.
- The group's member list marks with one antenna both who has a radio linked and whose news reaches this device by radio, saying which in its name.

This amends [ADR-0061](0061-member-state.md).

## Consequences

- A coordinator sees at a glance who can still be reached without coverage, and a member who cannot is told while there is time to link a radio.
- The bit says what the app knows now: a member whose radio is linked but out of range of everyone still shows as having one.
- Older apps ignore the bit, as protocol §3.14 asks of unknown bits.
