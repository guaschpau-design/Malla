# 0030. Official weather warnings, gathered by the server from MeteoAlarm

- Status: Accepted
- Date: 2026-10-26

## Context

Teams go out in rain, wind, snow and heat. The national weather services (AEMET in Spain, IPMA in Portugal) issue yellow, orange and red warnings by region, and a team should know which are in force where it works without leaving the app. Forecasts are another matter: every phone already has a weather app, and a forecast adds nothing to the team's shared picture.

EUMETNET's MeteoAlarm republishes the warnings of every European service in one format (CAP), as JSON feeds per country, under CC BY 4.0. The feeds name each warning's regions by code (`EMMA_ID`) but do not draw them; the outlines are a separate GeoJSON file, published now and then in MeteoAlarm's documents repository. Browsers cannot read the feeds directly (no CORS), and the outlines file is large.

## Decision

- The server gathers the warnings and publishes them at `GET v1/weather-warnings` (protocol §8.4): one GeoJSON document with the regions under some warning, each with its warnings in Spanish and English, coordinates rounded to about 100 m. It is public, not group data, and any origin may read it.
- Warnings are read every 10 minutes. The outlines are looked for once a day and downloaded only when a new file appears; the server keeps the outlines of its countries next to its database. The document is built once per gathering and served as it is.
- `TESEL_WEATHER` chooses the countries (`ES,PT` by default) or turns it `off`.
- The app reads the warnings from the server that serves it, every 10 minutes while it is in view and online, and keeps the last ones on the device for use without coverage. Expired warnings drop out by themselves.
- On the map, each region under warning is tinted in its level's colour, beneath everything else. A card shows the warnings where this device is, while the GPS knows; the panel of any point shows those there. One layer switch hides all of it. The source is credited wherever warnings are shown.

## Consequences

- No new event and nothing on the radio: warnings reach phones through the server, and stay on the device afterwards.
- One request every 10 minutes per app, of a small document; the server makes three requests to MeteoAlarm in the same time, whatever the number of users.
- A command post without internet gathers nothing and its apps keep the last warnings they had; it logs the first failure only.
- Other countries take one line each (their feed's URL) once someone needs them.
- Taps on the map are not taken by the regions, which cover large areas: the point panel is where warnings are read away from this device.
