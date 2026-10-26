# 0028. Roll call: one event, answered with an ACK by each member

- Status: Accepted
- Date: 2026-10-26

## Context

The most frequent check on a voice radio net is the roll call: "is everyone well?", and each person answers. Coordinators need it in Tesel too, also when the team is reachable by LoRa only. Answers must come from every member, which is the opposite of how acknowledgements of an SOS work over LoRa: there, the first answer is enough and the others stay quiet to save airtime (protocol §3.8).

## Decision

- A new event type, `ROLL_CALL` (protocol §3.12), carries the question, empty for the usual one, so each receiver words it in its own language.
- Members answer with the `ACK` that already exists. Over LoRa, answers to a roll call wait the usual random delay but are never dropped for having heard someone else's answer.
- The newest roll call is the current one. It is open for answers for 30 minutes; then it is history, in the diary.
- Coordinators call the roll from the chat (a UI rule, like alerts: ADR-0005). Each member gets a banner with two buttons: "I'm well", which answers, and "I need help", which opens the SOS dialog. The caller's banner counts the answers and names who has not answered yet.
- Those expected to answer are the members the group knows, except the caller.

## Consequences

- One event per roll call and one small event per answer: a group of 20 on LoRa spends about 20 short transmissions, spread over half a minute.
- Members who have left a group still count as expected, since the protocol has no leaving event. The caller sees them among those who have not answered.
- Anyone could send a `ROLL_CALL` with a modified client; like alerts, the role is a rule of the app, not of the protocol.
