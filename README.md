# Tesel

**Consciencia situacional para equipos.** Posiciones, mensajes, alertas e incidentes de todo el equipo en un mapa común y en tiempo real: con internet, por radio LoRa (MeshCore) o desde un puesto de mando cuando la red cae. Software libre, cifrado de extremo a extremo y sin cuentas.

**Situational awareness for teams.** The whole team's positions, messages, alerts and incidents on one shared map, in real time: over the internet, over LoRa radio (MeshCore) or through a command post when the network goes down. Free software, end-to-end encrypted, no accounts.

> Estado: en desarrollo, hacia la v0.1. · Status: in development, towards v0.1.
>
> El nombre viene de las **teselas**, las piezas de un mosaico y de un mapa digital: muchas pequeñas que solo juntas forman la imagen. · The name comes from **tesserae**: the small tiles of a mosaic, and of a digital map.

**Pruébala · Try it:** <https://tesel.eu> — se publica sola con cada cambio que pasa las pruebas · published automatically on every change that passes CI.

## Principios · Principles

- **Nadie lo controla.** Libre (EUPL-1.2), gratuito y sin cuentas. · **Nobody controls it.** Free software (EUPL-1.2), no cost, no accounts.
- **Funciona sin infraestructura.** Pensado para cuando cae la red móvil. · **Works without infrastructure.** Built for when the mobile network fails.
- **Los datos son del grupo.** El servidor solo ve datos cifrados. · **The data belongs to the group.** Servers only ever see ciphertext.

## Documentación · Documentation

| Documento                                    | Contenido                                |
| -------------------------------------------- | ---------------------------------------- |
| [docs/briefing.md](docs/briefing.md)         | Visión, alcance y planning (español)     |
| [docs/hoja-de-ruta.md](docs/hoja-de-ruta.md) | Qué viene después, por fases (español)   |
| [ARCHITECTURE.md](ARCHITECTURE.md)           | How the system is built                  |
| [docs/protocol.md](docs/protocol.md)         | Wire format specification                |
| [docs/hardware.md](docs/hardware.md)         | Supported radios and how to flash them   |
| [docs/decisions/](docs/decisions/)           | Architecture decision records            |
| [CONTRIBUTING.md](CONTRIBUTING.md)           | Rules for every contributor, human or AI |

## Desarrollo · Development

Requires Node.js 22.18+ and pnpm 10.

```sh
pnpm install
pnpm dev     # web app and server
pnpm check   # everything CI runs
```

## Licencia · Licence

[EUPL-1.2](LICENSE)
