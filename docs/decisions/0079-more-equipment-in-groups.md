# 0079. More equipment, offered in groups

- Status: Accepted
- Date: 2026-10-31

## Context

The equipment a member can tell (ADR-0061) was thirteen items, chosen for a first aid post and a search on foot. What decides whom a coordinator sends in a flood, a storm or a night search was missing: a 4×4 or a boat, a search dog, a thermal camera, a satellite phone when no network nor radio reaches, tools, a chainsaw, a pump, a generator or a power bank to keep phones and radios going, oxygen, a megaphone. `MEMBER_STATE.equipment` is a `u32` with fourteen bits used, and other bits are ignored by those who do not know them. Thirteen chips already filled the panel; twenty-five in one block would not read at a glance.

## Decision

- Twelve more items take bits 14 to 25 of `MEMBER_STATE.equipment`, in this order: 4×4 vehicle, boat, search dog, thermal camera, satellite phone, generator, power bank, chainsaw, water pump, hand tools, oxygen, megaphone (protocol §3.14). The event keeps its 21 bytes.
- Me offers the equipment in four small groups, each under its name: care and supplies, rescue and safety, tools and power, transport and communication (`EQUIPMENT_GROUPS`). A teammate's card still lists what they carry on one line.
- Items for specialised teams only (cutting gear for vehicles, chemical protection suits) are left out: those teams bring their own.

This amends [ADR-0061](0061-member-state.md).

## Consequences

- A coordinator can see who has a boat, a dog or a satellite phone before sending anyone.
- An app from before this change does not show the new items of others; it drops none of its own.
- Six bits remain free in the field for later items.
