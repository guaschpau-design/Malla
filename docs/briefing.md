# Briefing del proyecto

> Nombre provisional: **Malla**. El nombre definitivo se decidirá más adelante; está centralizado para poder cambiarlo con una búsqueda y sustitución.
>
> Estado: aprobado para desarrollo · Fecha: 25 de octubre de 2026 · Versión objetivo: v0.1

## 1. Qué es

Malla es una aplicación libre, gratuita y de código abierto de **consciencia situacional para la sociedad civil europea**: un mapa compartido en tiempo real donde un grupo ve a sus miembros, se comunica y marca lo que ocurre sobre el terreno, **también cuando no hay internet**, gracias a las redes de radio LoRa (MeshCore y, más adelante, Meshtastic).

Es la respuesta europea y abierta a lo que ATAK hace en Estados Unidos, con tres diferencias de principio:

1. **Nadie la controla.** Ni gobiernos ni empresas. Cualquiera puede usarla, también las administraciones, pero ninguna entidad decide quién puede o no puede.
2. **Funciona sin infraestructura.** Diseñada desde el primer día para el escenario en que cae la red móvil.
3. **Los datos son del grupo.** El servidor, cuando existe, solo ve datos cifrados que no puede leer.

## 2. Para quién

Para toda la sociedad civil, sin excluir a nadie:

- Protección civil y voluntariado de emergencias.
- Equipos de rescate y montaña.
- ONG y ayuda humanitaria.
- Grupos de ciudadanos: vecinos, grupos outdoor, personas preparadas para emergencias.
- Administraciones que quieran usarla (abierta a todos, controlada por nadie).

## 3. Escenarios en los que tiene que funcionar

| Escenario                                                  | Qué exige a la app                                              |
| ---------------------------------------------------------- | --------------------------------------------------------------- |
| Catástrofe natural (DANA, inundación, incendio, terremoto) | Mapa sin conexión, posiciones del equipo, zonas de peligro, SOS |
| Apagón general                                             | Funcionar solo con LoRa y batería; mensajes cortos y robustos   |
| Búsqueda de personas                                       | Posiciones en vivo, zonas asignadas, marcadores de pistas       |
| Eventos masivos                                            | Muchos usuarios a la vez, alertas, coordinación por grupos      |

## 4. Decisiones tomadas en el briefing

| Bloque                    | Decisión                                                                                   |
| ------------------------- | ------------------------------------------------------------------------------------------ |
| Licencia                  | EUPL-1.2 (licencia libre oficial de la UE)                                                 |
| Gobernanza                | Proyecto personal de Pau, que se abre a la comunidad al publicarse                         |
| Desarrollo                | Pau dirige, Claude programa                                                                |
| Plataforma                | Aplicación web instalable (PWA) para móvil y ordenador, que funciona sin conexión          |
| Comunicaciones v0.1       | Internet + LoRa MeshCore (Bluetooth desde Chrome/Edge)                                     |
| Comunicaciones después    | LoRa Meshtastic; compatibilidad con ATAK (protocolo CoT)                                   |
| Infraestructura           | Funciona sin servidor; si hay servidor, sincroniza con él                                  |
| Servidor de pruebas       | VPS en un proveedor europeo                                                                |
| Código                    | GitHub                                                                                     |
| Idiomas                   | Español e inglés                                                                           |
| Grupos                    | Coordinador y miembros                                                                     |
| Identidad                 | Sin cuenta: alias y clave generados en el dispositivo; unión al grupo por código QR        |
| Cifrado                   | Por canal: cada grupo comparte una clave secreta                                           |
| Privacidad de la posición | La decide cada usuario: compartir, pausar u ocultar                                        |
| Simbología                | Civil por defecto; OTAN APP-6 seleccionable más adelante                                   |
| Mapas                     | OpenStreetMap con descarga para usar sin conexión; después satélite, topográfico y náutico |

## 5. Alcance de la v0.1

### Entra

1. **Posiciones en vivo** de los miembros del grupo en el mapa.
2. **Chat de grupo** por canal.
3. **Marcadores y zonas**: puntos, líneas y áreas dibujadas y compartidas.
4. **SOS y alertas**: botón de emergencia y avisos al grupo.
5. **Mapa OpenStreetMap** con descarga de una zona para usarlo sin conexión.
6. **Grupos con roles** y unión por código QR.
7. **Internet y LoRa MeshCore** como medios de transporte.
8. **Modo puesto de mando local** (ver sección 6).

### Después de la v0.1, por orden

1. Fotos adjuntas (solo por internet; LoRa no da para imágenes).
2. Tareas asignadas a personas o equipos.
3. Rutas y tracks.
4. Partes rápidos (situación, heridos, daños).
5. Mapas satélite, topográfico y náutico.
6. Simbología OTAN APP-6.
7. LoRa Meshtastic.
8. Compatibilidad con ATAK (CoT).

### No entra (por ahora)

- Voz y vídeo.
- Mensajes privados de persona a persona con cifrado extremo a extremo.
- Apps nativas para tiendas de aplicaciones.
- LoRa en iPhone (Safari no permite Bluetooth desde la web).

## 6. Los tres modos de funcionamiento

La app es la misma en los tres modos; cambia lo que hay disponible alrededor.

| Modo                | Situación                     | Cómo funciona                                                                                                                                                                                       |
| ------------------- | ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Conectado**       | Hay internet                  | Los móviles sincronizan con el servidor (VPS). LoRa, si está emparejada, actúa de respaldo.                                                                                                         |
| **Malla**           | Solo LoRa                     | Cada móvil, emparejado con su radio MeshCore, habla con los demás de radio en radio. Sin servidor.                                                                                                  |
| **Puesto de mando** | Solo LoRa + un servidor local | Un portátil o una Raspberry Pi con radio y wifi propio guarda el estado del incidente, da servicio por wifi a quien no tiene radio (también iPhone) y sincroniza con el VPS cuando vuelve internet. |

Una regla los une: **cualquier dispositivo que tenga a la vez radio e internet actúa de puente**, reenviando lo que llega por LoRa al servidor y al revés. No hace falta configurarlo.

## 7. Preparación previa: lo que cada persona debe hacer antes de la emergencia

Sin conexión no se puede instalar la app ni descargar mapas. Por eso la app guiará este procedimiento y lo marcará como completado:

1. Instalar la app desde el navegador (Chrome o Edge en Android y PC; Safari en iPhone, solo modo internet).
2. Unirse al grupo escaneando el código QR del coordinador.
3. Descargar el mapa de la zona de actuación.
4. Emparejar la radio MeshCore (firmware Companion BLE, v1.18 o superior) y comprobar que envía y recibe.

## 8. Límites técnicos que condicionan el diseño

| Límite                                                  | Valor                                                                    | Consecuencia                                                                                             |
| ------------------------------------------------------- | ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| Tamaño máximo de un mensaje de datos MeshCore por canal | 165 bytes                                                                | Protocolo binario compacto; textos de chat de hasta 151 bytes (unos 150 caracteres sin acentos) por LoRa |
| Ciclo de trabajo legal en 869,4–869,65 MHz (UE)         | 10 % del tiempo                                                          | Posiciones por LoRa cada pocos minutos, no cada segundo                                                  |
| Bluetooth desde la web                                  | Solo Chrome y Edge (Android, Windows, macOS, Linux)                      | iPhone: solo modo internet o vía puesto de mando                                                         |
| HTTPS obligatorio para instalar la app y usar Bluetooth | —                                                                        | El puesto de mando local necesita un certificado preparado de antemano                                   |
| Mapas OpenStreetMap                                     | La política de uso de los servidores públicos prohíbe la descarga masiva | Servimos nuestros propios mapas vectoriales (PMTiles) desde el VPS                                       |

## 9. Principios de calidad del código

Acordados para que el proyecto sea mantenible por cualquiera al liberarse (detalle en `CONTRIBUTING.md`):

1. Diseñar antes de programar: arquitectura, protocolo y decisiones documentadas.
2. Un reglamento único que siguen personas e IA, releído en cada sesión.
3. Comprobaciones automáticas: TypeScript estricto, formato, linter e integración continua.
4. Pruebas automáticas, sobre todo en protocolo y sincronización.
5. Refactorizar, no parchear.
6. Cambios pequeños, cada uno con su porqué.
7. Revisión independiente antes de cada versión y prueba de legibilidad antes de liberar.
8. Tecnología conocida a propósito.

## 10. Planning

Una semana de desarrollo más uno o dos días de margen, aceptados para no recortar las reglas de calidad.

| Día | Entrega                                                                                                                                         | Prueba de Pau                                |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| 0   | Briefing, reglamento, arquitectura, especificación del protocolo, decisiones, esqueleto del repositorio y codificador del protocolo con pruebas | Revisar el briefing                          |
| 1   | App instalable, mapa, descarga de zona sin conexión, español e inglés                                                                           | Instalarla en Android y PC                   |
| 2   | Identidad local, grupos con roles, unión por código QR                                                                                          | Crear un grupo y unir otro móvil             |
| 3   | Servidor en el VPS: posiciones y chat por internet, cifrados                                                                                    | Dos móviles viéndose en el mapa              |
| 4   | Marcadores, zonas, SOS, alertas, privacidad de la posición                                                                                      | Simular un incidente                         |
| 5   | MeshCore: posiciones, chat y SOS por LoRa                                                                                                       | Probar con sus radios, sin datos móviles     |
| 6   | Modo puesto de mando y sincronización al volver internet                                                                                        | Portátil o Raspberry Pi como puesto de mando |
| 7   | Limpieza, revisión independiente, guía de preparación y publicación de la v0.1                                                                  | Prueba de campo con 2–3 personas             |
| 8–9 | Margen                                                                                                                                          | —                                            |

El día 5 es el de más riesgo: la integración con la radio solo se valida con equipos reales.

## 11. Lo que necesito de Pau

- [ ] Repositorio vacío en GitHub (nombre provisional) conectado a la sesión con permiso de escritura.
- [ ] VPS europeo (Hetzner, OVH o Scaleway) y un dominio.
- [ ] Modelos de las radios MeshCore y Meshtastic disponibles; radios MeshCore con firmware Companion BLE v1.18 o superior.
- [ ] Unos 30 minutos diarios de pruebas con un Android con Chrome, un PC y, si es posible, un iPhone.
- [ ] Opcional: Raspberry Pi 4 o 5 para el día 6.
- [ ] Día 7: dos o tres personas con radio para la prueba de campo.

## 12. Cuestiones abiertas

| Cuestión                                                                                                           | Cuándo se decide                                                                       |
| ------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| Nombre definitivo                                                                                                  | Antes de publicar la v0.1                                                              |
| Registro de un identificador de aplicación (`data_type`) en MeshCore; mientras tanto usamos el rango de desarrollo | Al tener la v0.1 funcionando (MeshCore exige demostrar el proyecto antes de asignarlo) |
| Fuente de mapas satélite para toda Europa con licencia libre                                                       | Al abordar mapas satélite                                                              |
| Procedimiento de certificado HTTPS del puesto de mando                                                             | Día 6                                                                                  |
