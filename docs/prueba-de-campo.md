# Prueba de campo de la v0.1

Lista para probar Teselia en condiciones reales antes de publicar la v0.1. Las pruebas automáticas cubren el código; esto cubre lo que solo se ve con móviles, radios y distancia de verdad. Apunta en cada punto qué pasó (y una captura si algo falla) y pásamelo: lo convierto en correcciones.

## Antes de salir

- [ ] Mapa propio en el servidor: ejecuta una vez en el VPS el comando de instalación (sección «Lo que necesito de Pau» de [`briefing.md`](briefing.md)) y comprueba que `https://teselia.eu/maps/basemap.pmtiles` descarga algo.
- [ ] Radios preparadas con MeshCore Companion Bluetooth v1.18 o superior, región EU/UK Narrow ([`hardware.md`](hardware.md)), y cargadas.
- [ ] En cada móvil: Teselia abierta desde `https://teselia.eu/app/`, añadida a la pantalla de inicio, con nombre elegido.
- [ ] Mapa de la zona de la prueba descargado en cada móvil («Mapas sin conexión»).
- [ ] Un grupo creado por quien coordina y todos unidos con el QR.

## 1. Con internet (10 minutos)

- [ ] Todos ven a los demás en el mapa al compartir la posición; al pausarla se queda la última; al ocultarla desaparece.
- [ ] El chat llega en ambos sentidos en pocos segundos.
- [ ] Un marcador y una zona dibujados por una persona los ven todas; los puede borrar otra.
- [ ] Un SOS llega a todos; «Recibido» le llega a quien lo envió; quien lo envió lo cancela.
- [ ] Una alerta crítica de quien coordina se queda en pantalla hasta confirmarla.
- [ ] iPhone: todo lo anterior funciona igual en Safari.

## 2. Sin internet, con radios (30 minutos)

Todos con datos móviles y wifi desactivados, Bluetooth encendido, radio conectada desde «LoRa».

- [ ] Al conectar, el panel muestra el nombre de la radio y el canal del grupo. La app de MeshCore muestra un canal nuevo con el nombre del grupo, sin haber tocado los otros.
- [ ] El chat llega por radio. Apunta cuánto tarda.
- [ ] Las posiciones se actualizan por radio (cada pocos minutos, no al momento).
- [ ] Un SOS llega por radio; se repite hasta que alguien pulsa «Recibido»; la cancelación también llega.
- [ ] El tiempo de emisión de la última hora (panel «LoRa») se queda por debajo del 100 %.
- [ ] Alcance: separaos poco a poco y apunta la distancia a la que dejan de llegar los mensajes, en ciudad y, si podéis, desde un sitio alto.
- [ ] Una persona con radio y con datos móviles hace de puente: lo que escribe alguien solo por radio llega a otra persona que solo tiene internet, y al revés.
- [ ] Si alguien usa la app de MeshCore cerca, sus mensajes aparecen en la pestaña «MeshCore» del chat.

## 3. iPhone con radio (opcional, 10 minutos)

- [ ] En el navegador Bluefy, abrir `https://teselia.eu/app/` y conectar una radio. Apunta si conecta y si envía y recibe.

## 4. Puesto de mando (si está montado, 30 minutos)

Requiere haber seguido [`deploy/command-post/README.md`](../deploy/command-post/README.md).

- [ ] Un móvil sin datos se conecta a la wifi del puesto, abre Teselia y arriba aparece «Puesto de mando» con el punto naranja. Apunta si el navegador pidió algún permiso.
- [ ] Un iPhone sin datos hace lo mismo y se comunica con el grupo.
- [ ] Un móvil que nunca tuvo Teselia abre `https://puesto.teselia.eu/app/`, se une al grupo escaneando el QR y ve el mapa completo.
- [ ] Con una radio conectada en el puesto (Chrome en el portátil), los mensajes de quien está en la wifi del puesto llegan a quien solo tiene radio, y al revés.
- [ ] Al dar internet al puesto (cable o móvil compartiendo datos por USB), lo escrito en el puesto aparece en un móvil que está fuera, por internet, y al revés.
- [ ] Desde un móvil conectado a la wifi del puesto no se puede abrir ninguna otra página ni ningún aparato de la red a la que está enchufado el puesto.

## Qué apuntar

- Qué no se entendió a la primera, con las palabras de quien lo probó.
- Distancias, tiempos de llegada y batería de móviles y radios al final.
- Cualquier error, con captura y la hora aproximada.
