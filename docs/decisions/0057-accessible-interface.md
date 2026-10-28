# 0057. Meet WCAG 2.1 AA in the app's colours, keyboard use and texts

- Status: Accepted
- Date: 2026-10-28

## Context

The audit of 27 October 2026 measured the app against WCAG 2.1 AA. Danger red on white was 4.2:1 and white on the dark theme's SOS button 3.0:1, below the 4.5:1 text needs; the focus ring, in the deep lime shade, hardly showed on the ink chrome; the edges of text fields were 1.5:1, where a control needs 3:1. Panels and menus could not be closed with Escape, did not take the keyboard's focus or give it back, and the dock's menus came before their button in the page. Every card on the map was a live region, so screen readers read out cards that are no news. English said "1 new events". Confirmations used the browser's `confirm()`, which stops the whole page and does not take the app's look or language.

## Decision

- **Colours by role, checked by a test.** One red cannot carry white text and be read on a dark surface, so danger has a fill (`--danger-fill`, white on it in both themes) and a colour for text and lines (`--danger`, lighter in the dark theme). The edge of a control that must be found to be used (fields, the switch's track) is `--control-line`, 3:1 on the surfaces; lines that only separate keep the softer `--border`. The focus ring is `--focus`, the line colour on content and lime on the chrome, which takes the class `.chrome`. Links have `--link`. `lib/ui/palette.test.ts` computes the contrast of each pair in both themes.
- **The keyboard follows what opens.** Opening a panel or a dock menu moves the focus into it; Escape closes it; closing gives the focus back to what had it, unless something else has taken it. A menu follows its button in the page.
- **Cards are regions, not announcements.** Each card on the map is a region named by what it is about. Only two things speak up by themselves: the alarm (`incidents/IncidentAlarm.svelte`) and the app's notices.
- **The app asks in its own dialog.** Questions before something that cannot be undone go through `lib/ui/confirmations.svelte.ts` and one dialog; ESLint forbids `confirm()`.
- **Plural forms.** A text with a count has a form per plural category of its language, picked by `Intl.PluralRules` from its `count` value; the type of `t` asks for the count. Numbers in texts are written as the language writes them.
- **Notches.** The top bar, the dock, the map's controls, the cards and the panels keep clear of the screen's safe areas on every side.

## Consequences

- Danger reads slightly darker on light surfaces, and the dark theme's SOS button is the light theme's red.
- A new colour pair that must be read goes into the palette test; a new panel gets the keyboard behaviour from `ui/Panel.svelte`.
- A new language gives plural forms to the same keys as English.
