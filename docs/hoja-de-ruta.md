# Hoja de ruta

Qué viene después de la v0.1 y en qué orden. El alcance de la v0.1 está en el [briefing](briefing.md) §5; aquí se apunta lo siguiente, fase a fase. Cada punto se cierra con su código, sus pruebas, su texto en la guía (español e inglés) y, si hace falta, su decisión (ADR).

## Fase 1 — Trabajo en el terreno, sin tocar el protocolo

Todo funciona en el dispositivo con los eventos que ya existen: no cambia el formato de la red ni hace falta actualizar el servidor. Es lo que más se usa en una intervención real y lo que ATAK resuelve mejor que nosotros hoy.

| #   | Punto                        | Qué hace                                                                                                                                                                  |
| --- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1.1 | Mi ubicación                 | Una sola lectura del GPS para todo (compartir, navegar, el mapa). Botón para centrar el mapa en uno mismo y seguirle; el punto propio se ve aunque no se comparta.        |
| 1.2 | Coordenadas                  | Grados decimales, grados-minutos-segundos, UTM y MGRS. Pulsación larga en el mapa para ver las coordenadas de un punto y copiarlas; ir a una coordenada que te dicten.    |
| 1.3 | Medir y navegar              | Distancia y rumbo desde uno mismo a cualquier punto, objeto o miembro; «Ir aquí» con una barra que guía hasta el destino; herramienta de medir distancias sobre el mapa.  |
| 1.4 | Recorridos                   | El rastro reciente de cada miembro, a partir de las posiciones que ya comparte. Si alguien oculta su posición, su rastro desaparece también.                              |
| 1.5 | Capas                        | Mostrar u ocultar miembros, recorridos y objetos del mapa; la elección se recuerda.                                                                                       |
| 1.6 | Por dónde llega cada miembro | En la ficha de cada miembro: lo último que llegó de él por radio y por internet, y cuándo. Sirve para saber de quién se tienen noticias por radio aunque caiga internet.  |
| 1.7 | Pantalla encendida           | Opción para que la pantalla no se apague mientras se trabaja con el mapa.                                                                                                 |
| 1.8 | Diario de la operación       | Todo lo que ha pasado en el grupo, en orden: mensajes, alertas, SOS, objetos. Se exporta como texto para el informe, y el registro completo se exporta e importa cifrado. |

Hecha el 26 de octubre de 2026.

## Fase 2 — Más sencilla, mejor mapa y tareas

Principio: que la app sea versátil y cada equipo la use a su manera, sin menús dentro de menús. Casi todo empieza donde se toca el mapa.

| #   | Punto                       | Qué hace                                                                                                                                                                   |
| --- | --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2.1 | Interfaz reorganizada       | Abajo, cuatro botones fijos (Yo, Añadir, Chat, Más) y el SOS. Tocar un punto, un marcador o un miembro abre sus acciones (guiar, marcar, medir). Las capas, junto al zoom. |
| 2.2 | Mapa topográfico y satélite | Ortofotos del PNOA y mapa topográfico del IGN (España, CC BY 4.0), descargables por zonas para usarlos sin conexión.                                                       |
| 2.3 | Relieve                     | Modelo digital del terreno: sombreado y curvas en el mapa, y desnivel y pendiente más dura del tramo cuando la app guía hasta un sitio.                                    |
| 2.4 | Tareas                      | Un texto corto y, si se quiere, una persona y un sitio del mapa; pendiente, en curso o hecha. Cualquiera puede crearlas; nada obligatorio más que el texto.                |

Las tareas usan un tipo de evento nuevo, `TASK` (protocolo §3.11, ADR-0025); el protocolo lo admite sin cambiar de versión.

Hecha el 26 de octubre de 2026.

## Después, por orden

Lo previsto en el briefing más lo aprendido de ATAK. Cada fase se detalla al empezarla.

1. Rutas por calles y caminos de OpenStreetMap: con internet, calculadas por el servidor; sin conexión, con la red de caminos de cada zona descargada.
2. Partes rápidos (situación, heridos, daños) con formularios fijos que caben por radio.
3. Rutas planificadas, con puntos de paso.
4. Fotos adjuntas (solo por internet; la radio no da para imágenes).
5. Exportar el mapa (objetos y recorridos) a KML y GeoJSON para otras herramientas.
6. Mapa náutico, e imagen de satélite fuera de España.
7. Simbología OTAN APP-6.
8. Radios Meshtastic.
9. Compatibilidad con ATAK (CoT).
10. Apps de Android e iPhone con el mismo código: segundo plano, radio en iPhone y avisos con la app cerrada. Aplazadas a propósito: primero la app web completa.
