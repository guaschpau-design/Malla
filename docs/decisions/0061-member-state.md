# 0061. What members tell about themselves: one event, one card

- Status: Accepted, amended by [0069](0069-who-keeps-in-touch-without-coverage.md) (a LoRa radio linked, told by the app)
- Date: 2026-10-28

## Context

A coordinator needs to know more of each person than where they are: what service they come from, whether they can be counted on now, how long their phone will last and what they carry, and what they have been handed. Members need to tell it without filling in forms, and to see the same of their teammates without leaving the map. Over the radio, every byte counts.

## Decision

- A new event type, `MEMBER_STATE` (docs/protocol.md §3.14), carries a member's profile, status (active, resting, off duty), battery percent and equipment as a set of bits: 21 bytes. The newest of each member replaces the others.
- A device sends it only when something changes, and the battery only in steps of 10 %; a device that never set anything sends nothing.
- Profile, status and equipment are preferences of the device, the same in every group. The battery is read where the browser tells it (Chrome and Edge); Safari, and so every iPhone, does not, and it shows as unknown there.
- "Me" and the panel of a member tapped on the map are one card (`MemberSheet`): profile and status at a glance, then position, battery, equipment and tasks folded into one line each until opened. In Me they are set; for others they are read.
- Sharing the position becomes one switch, with a second, when it is off, to hide where one was: the three modes of before (sharing, paused, hidden) in the words a member uses.
- Resting or off-duty members are drawn as empty rings on the map, and a change of status is a line of the diary.

## Consequences

- One small event per change, so a team of twenty costs the radio little.
- The card grows by folding: a section added later (a team, a role) takes one line until it is opened.
- What a member tells is what they chose to tell: the app does not check that someone marked "defibrillator" carries one.
